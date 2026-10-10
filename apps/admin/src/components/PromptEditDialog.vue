<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus'
import { computed, reactive, ref, watch } from 'vue'

import { BizError, type PromptGroupVO, type PromptVO } from '@mindforge/shared'

import { promptApi } from '@/api/prompt'

const visible = defineModel<boolean>({ required: true })

const props = defineProps<{
  /** 有值 = 编辑某个版本；没值 = 新建 */
  version: PromptVO | null
  /** 新建时用 —— 给哪个变体加版本 */
  group: PromptGroupVO | null
}>()

const emit = defineEmits<{ saved: [] }>()

const formRef = ref<FormInstance>()
const saving = ref(false)

const form = reactive({
  scene: '',
  name: '',
  content: '',
  label: '',
  description: '',
  userSelectable: false,
  isDefault: false,
})

const isEdit = computed(() => props.version !== null)

const rules: FormRules<typeof form> = {
  // 长度上限照抄后端的 @Size
  scene: [
    { required: true, message: '请填场景', trigger: 'blur' },
    { max: 32, message: '最长 32 个字符', trigger: 'blur' },
  ],
  name: [
    { required: true, message: '请填变体名', trigger: 'blur' },
    { max: 64, message: '最长 64 个字符', trigger: 'blur' },
  ],
  content: [{ required: true, message: '提示词正文不能为空', trigger: 'blur' }],
  label: [{ max: 64, message: '最长 64 个字符', trigger: 'blur' }],
  description: [{ max: 255, message: '最长 255 个字符', trigger: 'blur' }],
}

watch(visible, (open) => {
  if (!open) return

  if (props.version) {
    const v = props.version
    form.scene = v.scene
    form.name = v.name
    form.content = v.content
    form.label = v.label ?? ''
    form.description = v.description ?? ''
    form.userSelectable = v.userSelectable
    form.isDefault = v.isDefault
  } else {
    form.scene = props.group?.scene ?? ''
    form.name = props.group?.name ?? ''
    form.content = ''
    // 新建版本时把变体级的设置带过来 —— 免得每加一版都要重填
    form.label = props.group?.label ?? ''
    form.description = ''
    form.userSelectable = props.group?.userSelectable ?? false
    form.isDefault = props.group?.isDefault ?? false
  }
  formRef.value?.clearValidate()
})

async function onSubmit(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  try {
    if (isEdit.value && props.version) {
      // ⚠️ 修改时【不能】带 scene / name —— 后端 PromptUpdateDTO 里根本没有这两个字段，
      //    传了也会被忽略；而且改它们等于换变体，语义上就该走新建。
      await promptApi.update(props.version.id, {
        content: form.content,
        label: form.label.trim() || undefined,
        description: form.description.trim() || undefined,
        userSelectable: form.userSelectable,
        isDefault: form.isDefault,
      })
      ElMessage.success('已保存。⚠️ 改了内容记得发布，否则线上还是用旧的')
    } else {
      await promptApi.create({
        scene: form.scene.trim(),
        name: form.name.trim(),
        content: form.content,
        label: form.label.trim() || undefined,
        description: form.description.trim() || undefined,
        userSelectable: form.userSelectable,
        isDefault: form.isDefault,
      })
      ElMessage.success('已新建一个版本（默认不发布）')
    }
    emit('saved')
    visible.value = false
  } catch (e) {
    ElMessage.error(e instanceof BizError ? e.message : '保存失败')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <!-- ⚠️ append-to-body：卡片有 backdrop-filter + overflow:hidden，不加会被裁 -->
  <el-dialog
    v-model="visible"
    :title="
      isEdit ? `编辑 v${version?.version}` : group ? `给「${group.name}」加新版本` : '新建变体'
    "
    width="820px"
    append-to-body
    destroy-on-close
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
      @submit.prevent="onSubmit"
    >
      <div class="row">
        <el-form-item label="场景" prop="scene">
          <el-input
            v-model="form.scene"
            :disabled="isEdit || !!group"
            placeholder="如 rag_chat / resume_parse"
            maxlength="32"
          />
        </el-form-item>

        <el-form-item label="变体名" prop="name">
          <el-input
            v-model="form.name"
            :disabled="isEdit || !!group"
            placeholder="同一场景下的另一套说法就换个名字"
            maxlength="64"
          />
        </el-form-item>
      </div>

      <p v-if="isEdit || group" class="hint">
        场景和变体名建好就不能改 —— 改它们等于换一个变体，请用「新建变体」。
      </p>

      <el-form-item label="提示词正文" prop="content">
        <el-input
          v-model="form.content"
          type="textarea"
          :rows="16"
          placeholder="提示词正文。如果里面有 {context} 这类占位符，保持原样 —— 后端会替换。"
        />
      </el-form-item>

      <div class="row">
        <el-form-item label="选项名（用户端显示）" prop="label">
          <el-input v-model="form.label" placeholder="如「严谨模式」" maxlength="64" />
        </el-form-item>

        <el-form-item label="备注" prop="description">
          <el-input v-model="form.description" placeholder="这版改了什么" maxlength="255" />
        </el-form-item>
      </div>

      <div class="row">
        <el-form-item label="允许用户选择">
          <el-switch v-model="form.userSelectable" />
          <span class="hint hint--inline">开了才会出现在用户端的选项里</span>
        </el-form-item>

        <el-form-item label="设为该场景的默认">
          <el-switch v-model="form.isDefault" />
        </el-form-item>
      </div>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="onSubmit">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--mf-space-4);
}

@media (width <= 700px) {
  .row {
    grid-template-columns: 1fr;
  }
}

.hint {
  margin: calc(-1 * var(--mf-space-2)) 0 var(--mf-space-4);
  font-size: var(--mf-font-xs);
  line-height: 1.6;
  color: var(--mf-text-tertiary);
}

.hint--inline {
  margin: 0 0 0 var(--mf-space-3);
}
</style>
