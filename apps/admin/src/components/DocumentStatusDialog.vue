<script setup lang="ts">
import { reactive, ref, watch } from 'vue'

import type {
  AdminDocumentVO,
  ChunkStatus,
  DocumentStatusUpdateDTO,
  ParseStatus,
  VectorStatus,
} from '@mindforge/shared'
import { BizError } from '@mindforge/shared'

import { documentApi } from '@/api/document'

const visible = defineModel<boolean>({ required: true })

const props = defineProps<{
  /** 要修正状态的文档；null = 弹窗关闭中 */
  doc: AdminDocumentVO | null
}>()

const emit = defineEmits<{ saved: [] }>()

const saving = ref(false)

/**
 * 三段状态各自的合法取值 —— 与后端 `ParseStatus` / `ChunkStatus` / `VectorStatus` 一致。
 * 写成显式清单而不是让管理员随便填，拼错了后端会拒绝。
 */
const PARSE_OPTIONS: ParseStatus[] = ['PENDING', 'PARSING', 'SUCCESS', 'FAILED']
const CHUNK_OPTIONS: ChunkStatus[] = ['PENDING', 'CHUNKING', 'SUCCESS', 'FAILED']
const VECTOR_OPTIONS: VectorStatus[] = ['PENDING', 'EMBEDDING', 'SUCCESS', 'FAILED']

/** 状态值的中文 —— 列表页和这个弹窗用同一套词，别一边「完成」一边「成功」 */
const STAGE_TEXT: Record<string, string> = {
  PENDING: '等待',
  PARSING: '解析中',
  CHUNKING: '分块中',
  EMBEDDING: '嵌入中',
  SUCCESS: '完成',
  FAILED: '失败',
}

const form = reactive<{
  parseStatus: ParseStatus
  chunkStatus: ChunkStatus
  vectorStatus: VectorStatus
  pageCount: number | null
  errorMessage: string
  clearError: boolean
}>({
  parseStatus: 'PENDING',
  chunkStatus: 'PENDING',
  vectorStatus: 'PENDING',
  pageCount: null,
  errorMessage: '',
  clearError: false,
})

/**
 * 打开时用当前值填表 —— 三个状态下拉不动就等于「保持原值」，
 * 提交时原样传回去是无害的（幂等）。
 */
watch(visible, (open) => {
  if (!open || !props.doc) return
  form.parseStatus = (props.doc.parseStatus ?? 'PENDING') as ParseStatus
  form.chunkStatus = (props.doc.chunkStatus ?? 'PENDING') as ChunkStatus
  form.vectorStatus = (props.doc.vectorStatus ?? 'PENDING') as VectorStatus
  form.pageCount = props.doc.pageCount
  form.errorMessage = props.doc.errorMessage ?? ''
  form.clearError = false
})

async function onSubmit(): Promise<void> {
  if (!props.doc) return

  /**
   * errorMessage 的三态语义（后端约定）：
   *   勾了「清空」→ 传空串 = 清掉；填了内容 → 覆盖；两者都没有 → 不传 = 不改。
   * 直接把空串发上去会被当成「清空」，所以不传必须靠 undefined。
   */
  const dto: DocumentStatusUpdateDTO = {
    parseStatus: form.parseStatus,
    chunkStatus: form.chunkStatus,
    vectorStatus: form.vectorStatus,
  }
  if (form.pageCount !== null) dto.pageCount = form.pageCount
  if (form.clearError) dto.errorMessage = ''
  else if (form.errorMessage.trim()) dto.errorMessage = form.errorMessage.trim()

  saving.value = true
  try {
    await documentApi.updateStatus(props.doc.documentId, dto)
    ElMessage.success('已更新处理状态')
    visible.value = false
    emit('saved')
  } catch (e) {
    ElMessage.error(e instanceof BizError ? e.message : '更新失败')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <!-- ★ 在 el-card 里渲染的弹窗必须 append-to-body（backdrop-filter 的包含块坑） -->
  <el-dialog
    v-model="visible"
    :title="doc ? `修正处理状态 · ${doc.fileName}` : '修正处理状态'"
    width="min(520px, 92vw)"
    append-to-body
  >
    <p class="hint">
      这是人工纠错入口 —— AI 服务卡住导致一直 PENDING 时，把状态改成实际结果。 三段状态由后端和 AI
      服务分别推进，改完不会重跑流水线。
    </p>

    <el-form label-width="90px">
      <el-form-item label="解析">
        <el-select v-model="form.parseStatus" class="stage-select">
          <el-option v-for="s in PARSE_OPTIONS" :key="s" :label="STAGE_TEXT[s]" :value="s" />
        </el-select>
      </el-form-item>
      <el-form-item label="分块">
        <el-select v-model="form.chunkStatus" class="stage-select">
          <el-option v-for="s in CHUNK_OPTIONS" :key="s" :label="STAGE_TEXT[s]" :value="s" />
        </el-select>
      </el-form-item>
      <el-form-item label="向量化">
        <el-select v-model="form.vectorStatus" class="stage-select">
          <el-option v-for="s in VECTOR_OPTIONS" :key="s" :label="STAGE_TEXT[s]" :value="s" />
        </el-select>
      </el-form-item>
      <el-form-item label="页数">
        <el-input-number v-model="form.pageCount" :min="1" placeholder="留空 = 不改" />
      </el-form-item>
      <el-form-item label="失败原因">
        <el-input
          v-model="form.errorMessage"
          type="textarea"
          :rows="2"
          placeholder="覆盖原有失败原因；不改就留空"
        />
        <el-checkbox v-model="form.clearError">清空失败原因</el-checkbox>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="onSubmit">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.hint {
  margin: 0 0 var(--mf-space-4);
  font-size: var(--mf-font-sm);
  line-height: 1.6;
  color: var(--mf-text-tertiary);
}

.stage-select {
  width: 160px;
}
</style>
