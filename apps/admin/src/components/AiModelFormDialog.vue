<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'

import type { AiModelVO, AiScene } from '@mindforge/shared'
import { BizError } from '@mindforge/shared'

import { aiModelApi } from '@/api/ai'

const visible = defineModel<boolean>({ required: true })

const props = defineProps<{
  /** null = 新增，有值 = 编辑 */
  model: AiModelVO | null
  /**
   * 新增时预填的用途。
   *
   * 列表页已按用途分组，从「新增向量化配置」进来的人不该再选一遍用途 ——
   * 选错用途的后果不是报错，而是「加了一条配置却毫无效果」，最难自查。
   * ⚠️ 只在新增时生效，编辑时以 `model.scene` 为准。
   */
  defaultScene?: AiScene
}>()

const emit = defineEmits<{ saved: [] }>()

const saving = ref(false)
const isEdit = computed(() => props.model !== null)

const SCENE_OPTIONS: { value: AiScene; label: string }[] = [
  { value: 'CHAT', label: '对话' },
  { value: 'EMBEDDING', label: '向量化' },
  { value: 'RERANK', label: '重排' },
]

/**
 * schema 里注释的三个提供方做候选；允许手输别的（allow-create）——
 * provider 后端只是普通字符串，硬编成下拉反而挡住新接入的厂商。
 */
const PROVIDER_OPTIONS = ['dashscope', 'deepseek', 'openai']

/**
 * ⚠️ apiKey 永远不从后端回显（接口只给 `apiKeyHint`）。
 * 编辑时输入框必须是空的：填了 = 换 Key，留空 = 保持原 Key。
 * 提交时【绝不能把空串发上去】—— 那会把已有 Key 覆盖掉。
 */
const form = reactive({
  name: '',
  scene: 'CHAT' as AiScene,
  provider: '',
  modelName: '',
  baseUrl: '',
  apiKey: '',
  temperature: null as number | null,
  maxTokens: null as number | null,
  timeoutSeconds: null as number | null,
  isDefault: false,
  /** 1 启用 / 0 禁用 */
  status: 1,
  description: '',
})

watch(visible, (open) => {
  if (!open) return
  if (props.model) {
    form.name = props.model.name
    form.scene = props.model.scene
    form.provider = props.model.provider
    form.modelName = props.model.modelName
    form.baseUrl = props.model.baseUrl ?? ''
    form.apiKey = ''
    form.temperature = props.model.temperature
    form.maxTokens = props.model.maxTokens
    form.timeoutSeconds = props.model.timeoutSeconds
    form.isDefault = props.model.isDefault
    form.status = props.model.status
    form.description = props.model.description ?? ''
  } else {
    form.name = ''
    form.scene = props.defaultScene ?? 'CHAT'
    form.provider = ''
    form.modelName = ''
    form.baseUrl = ''
    form.apiKey = ''
    form.temperature = null
    form.maxTokens = null
    form.timeoutSeconds = null
    form.isDefault = false
    form.status = 1
    form.description = ''
  }
})

async function onSubmit(): Promise<void> {
  saving.value = true
  try {
    // 数值输入框清空后是 null —— null 转 undefined 才表示「不设置」
    const numbers = {
      temperature: form.temperature ?? undefined,
      maxTokens: form.maxTokens ?? undefined,
      timeoutSeconds: form.timeoutSeconds ?? undefined,
    }

    if (props.model) {
      await aiModelApi.update(props.model.id, {
        name: form.name.trim(),
        scene: form.scene,
        provider: form.provider.trim(),
        modelName: form.modelName.trim(),
        // 留空 = 不改 —— 空串会不会被后端当成「清空」没有约定，别赌
        baseUrl: form.baseUrl.trim() || undefined,
        apiKey: form.apiKey.trim() || undefined,
        ...numbers,
        isDefault: form.isDefault,
        status: form.status,
        description: form.description.trim() || undefined,
      })
    } else {
      await aiModelApi.create({
        name: form.name.trim(),
        scene: form.scene,
        provider: form.provider.trim(),
        modelName: form.modelName.trim(),
        baseUrl: form.baseUrl.trim() || undefined,
        apiKey: form.apiKey.trim() || undefined,
        ...numbers,
        isDefault: form.isDefault,
        status: form.status,
        description: form.description.trim() || undefined,
      })
    }

    ElMessage.success('已保存')
    visible.value = false
    emit('saved')
  } catch (e) {
    ElMessage.error(e instanceof BizError ? e.message : '保存失败')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <!-- ★ 在 el-card 里渲染的弹窗必须 append-to-body（backdrop-filter 的包含块坑） -->
  <el-dialog
    v-model="visible"
    :title="isEdit ? '编辑模型配置' : '新增模型配置'"
    width="min(560px, 92vw)"
    append-to-body
  >
    <el-form label-width="100px">
      <el-form-item label="名称" required>
        <el-input v-model="form.name" placeholder="如 deepseek-chat 主力" />
      </el-form-item>
      <el-form-item label="用途" required>
        <el-select v-model="form.scene">
          <el-option v-for="s in SCENE_OPTIONS" :key="s.value" :label="s.label" :value="s.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="提供方" required>
        <el-select v-model="form.provider" filterable allow-create default-first-option>
          <el-option v-for="p in PROVIDER_OPTIONS" :key="p" :label="p" :value="p" />
        </el-select>
      </el-form-item>
      <el-form-item label="模型名" required>
        <el-input v-model="form.modelName" placeholder="如 deepseek-chat / qwen-plus" />
      </el-form-item>
      <el-form-item label="Base URL">
        <el-input v-model="form.baseUrl" placeholder="不填用提供方默认地址" />
      </el-form-item>
      <el-form-item label="API Key">
        <div class="apikey">
          <el-input
            v-model="form.apiKey"
            type="password"
            show-password
            autocomplete="new-password"
            :placeholder="isEdit ? '留空 = 保持现有 Key 不变' : '不填则暂不配置'"
          />
          <span v-if="isEdit && props.model?.hasApiKey" class="apikey__hint">
            当前：{{ props.model.apiKeyHint }}
          </span>
        </div>
      </el-form-item>
      <el-form-item label="Temperature">
        <el-input-number v-model="form.temperature" :min="0" :max="2" :step="0.1" />
        <span class="tip">0~2，留空用默认</span>
      </el-form-item>
      <el-form-item label="Max Tokens">
        <el-input-number v-model="form.maxTokens" :min="1" :step="256" />
        <span class="tip">留空用默认</span>
      </el-form-item>
      <el-form-item label="超时（秒）">
        <el-input-number v-model="form.timeoutSeconds" :min="1" :step="10" />
        <span class="tip">留空用默认</span>
      </el-form-item>
      <el-form-item label="默认配置">
        <el-switch v-model="form.isDefault" />
        <span class="tip">该用途下的默认模型</span>
      </el-form-item>
      <el-form-item label="启用">
        <el-switch v-model="form.status" :active-value="1" :inactive-value="0" />
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="form.description" type="textarea" :rows="2" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="onSubmit">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.apikey {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-1);
  width: 100%;
}

.apikey__hint {
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

.tip {
  margin-left: var(--mf-space-3);
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}
</style>
