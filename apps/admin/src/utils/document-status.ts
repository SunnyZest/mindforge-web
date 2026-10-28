/**
 * 文档状态的展示口径 —— 列表页与详情抽屉共用一份。
 *
 * ⚠️ 别再在组件里各写一份：同一个 FAILED 在一处是红色、另一处是灰色，
 *    排查问题时会被颜色带偏。要改口径只改这里。
 *
 * 取值来源是后端 `DocumentStatusUtils.aggregate()`，不是猜的：
 * 失败优先（任一段 FAILED 整体 FAILED），然后按推进最远的一段给
 * COMPLETED / CHUNKED / PARSED，正在解析给 PARSING，否则 UPLOADED。
 */
import type { StatusTone } from '@/components/StatusTag.vue'

/** 聚合总状态 → 中文 */
export const STATUS_TEXT: Record<string, string> = {
  UPLOADED: '已上传',
  PARSING: '解析中',
  PARSED: '已解析',
  CHUNKED: '已分块',
  COMPLETED: '已完成',
  FAILED: '失败',
}

/** 聚合总状态 → 配色 */
export const STATUS_TONE: Record<string, StatusTone> = {
  UPLOADED: 'neutral',
  PARSING: 'warning',
  PARSED: 'info',
  CHUNKED: 'info',
  COMPLETED: 'success',
  FAILED: 'danger',
}

/** 三段状态展示用的固定顺序（后端字段也是这个顺序推进的） */
export const STAGES = [
  { key: 'parseStatus', label: '解析' },
  { key: 'chunkStatus', label: '分块' },
  { key: 'vectorStatus', label: '向量' },
] as const

/** 单段状态 → 中文 */
export const STAGE_TEXT: Record<string, string> = {
  PENDING: '等待',
  PARSING: '解析中',
  CHUNKING: '分块中',
  EMBEDDING: '嵌入中',
  SUCCESS: '完成',
  FAILED: '失败',
}

/** 单段状态 → 配色 */
export const STAGE_TONE: Record<string, StatusTone> = {
  PENDING: 'neutral',
  PARSING: 'warning',
  CHUNKING: 'warning',
  EMBEDDING: 'warning',
  SUCCESS: 'success',
  FAILED: 'danger',
}
