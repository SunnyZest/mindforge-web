<script setup lang="ts">
import { onMounted, ref } from 'vue'

import type { AiModelVO, AiScene } from '@mindforge/shared'
import { BizError } from '@mindforge/shared'

import { aiModelApi } from '@/api/ai'
import AiModelFormDialog from '@/components/AiModelFormDialog.vue'
import StatusTag from '@/components/StatusTag.vue'
import { useAuthStore } from '@/stores/auth'
import { formatDateTime } from '@/utils/format'

const auth = useAuthStore()

const loading = ref(false)
const rows = ref<AiModelVO[]>([])

/**
 * 用途筛选。`undefined` = 全部（后端 `scene` 不传就返回所有用途的配置）。
 */
const SCENE_OPTIONS: { value: AiScene; label: string }[] = [
  { value: 'CHAT', label: '对话' },
  { value: 'EMBEDDING', label: '向量化' },
  { value: 'RERANK', label: '重排' },
]

const SCENE_TEXT: Record<AiScene, string> = { CHAT: '对话', EMBEDDING: '向量化', RERANK: '重排' }

const scene = ref<AiScene | undefined>(undefined)

const formVisible = ref(false)
/** null = 新增 */
const formModel = ref<AiModelVO | null>(null)

function fail(e: unknown, fallback: string): void {
  ElMessage.error(e instanceof BizError ? e.message : fallback)
}

/** el-table 插槽的 row 是 `DefaultRow`，转成我们的类型 */
function asModel(row: unknown): AiModelVO {
  return row as AiModelVO
}

/**
 * 模型配置列表。
 *
 * ⚠️ 返回的是**数组不是分页**（同角色列表）—— 配置就几条，别加分页控件。
 */
async function load(): Promise<void> {
  loading.value = true
  try {
    rows.value = await aiModelApi.list(scene.value)
  } catch (e) {
    fail(e, '加载失败')
  } finally {
    loading.value = false
  }
}

function onSceneChange(): void {
  void load()
}

function onCreate(): void {
  formModel.value = null
  formVisible.value = true
}

function onEdit(row: AiModelVO): void {
  formModel.value = row
  formVisible.value = true
}

async function onDelete(row: AiModelVO): Promise<void> {
  const ok = await ElMessageBox.confirm(
    `删除模型配置「${row.name}」后，走它调用的功能（对话 / 检索 / 重排）会失败，` +
      '除非该用途下还有别的启用配置。确定删除吗？',
    '删除确认',
    { type: 'warning', confirmButtonText: '删除' },
  ).catch(() => false)
  if (!ok) return

  try {
    await aiModelApi.remove(row.id)
    ElMessage.success('已删除')
    await load()
  } catch (e) {
    fail(e, '删除失败')
  }
}

onMounted(load)
</script>

<template>
  <el-card shadow="never">
    <div class="filters">
      <el-select
        v-model="scene"
        placeholder="全部用途"
        clearable
        class="filters__select"
        @change="onSceneChange"
      >
        <el-option v-for="s in SCENE_OPTIONS" :key="s.value" :label="s.label" :value="s.value" />
      </el-select>

      <span class="filters__hint">
        这里配的是后端调模型用的地址和 Key，改完立即生效，不用重启服务。
      </span>

      <el-button v-if="auth.can('admin:ai:manage')" type="primary" @click="onCreate">
        新增配置
      </el-button>
    </div>

    <!-- 列宽合计 925px，最窄视口（1366）下内容区约 1040px -->
    <el-table v-loading="loading" :data="rows" border stripe>
      <el-table-column prop="name" label="名称" min-width="120" show-overflow-tooltip />
      <el-table-column label="用途" width="80" align="center">
        <template #default="{ row }">{{ SCENE_TEXT[asModel(row).scene] }}</template>
      </el-table-column>
      <el-table-column prop="provider" label="提供方" width="100">
        <template #default="{ row }">
          <code class="code">{{ asModel(row).provider }}</code>
        </template>
      </el-table-column>
      <el-table-column prop="modelName" label="模型名" min-width="130" show-overflow-tooltip />
      <el-table-column label="默认" width="70" align="center">
        <template #default="{ row }">
          <StatusTag v-if="asModel(row).isDefault" tone="info">默认</StatusTag>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column label="API Key" width="110">
        <template #default="{ row }">
          <!-- 后端永远不给明文，只有尾号提示。没配就明说，别显示成空 -->
          <span v-if="asModel(row).hasApiKey" class="keyhint">
            {{ asModel(row).apiKeyHint || '已配置' }}
          </span>
          <span v-else class="keyhint keyhint--none">未配置</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="80" align="center">
        <template #default="{ row }">
          <StatusTag :tone="asModel(row).status === 1 ? 'success' : 'danger'">
            {{ asModel(row).status === 1 ? '启用' : '禁用' }}
          </StatusTag>
        </template>
      </el-table-column>
      <el-table-column label="更新时间" width="145">
        <template #default="{ row }">{{ formatDateTime(asModel(row).updatedAt) }}</template>
      </el-table-column>

      <el-table-column label="操作" width="110" fixed="right">
        <template #default="{ row }">
          <span class="actions">
            <el-button link type="primary" @click="onEdit(asModel(row))">编辑</el-button>
            <el-button link type="danger" @click="onDelete(asModel(row))">删除</el-button>
          </span>
        </template>
      </el-table-column>

      <template #empty>还没有模型配置</template>
    </el-table>

    <AiModelFormDialog v-model="formVisible" :model="formModel" @saved="load" />
  </el-card>
</template>

<style scoped>
.filters {
  display: flex;
  gap: var(--mf-space-4);
  align-items: center;
  margin-bottom: var(--mf-space-4);
}

.filters__select {
  width: 140px;
}

.filters__hint {
  flex: 1;
  font-size: var(--mf-font-sm);
  color: var(--mf-text-tertiary);
}

.code {
  font-family: var(--mf-font-mono, ui-monospace, monospace);
  font-size: var(--mf-font-xs);
  color: var(--mf-text-secondary);
}

.keyhint {
  font-family: var(--mf-font-mono, ui-monospace, monospace);
  font-size: var(--mf-font-xs);
  color: var(--mf-text-secondary);
}

.keyhint--none {
  font-family: inherit;
  color: var(--mf-text-tertiary);
}

.actions {
  display: inline-flex;
  gap: var(--mf-space-2);
  white-space: nowrap;
}
</style>
