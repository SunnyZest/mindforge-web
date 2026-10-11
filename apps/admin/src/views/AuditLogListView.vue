<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import type { AuditLogVO } from '@mindforge/shared'
import { BizError } from '@mindforge/shared'

import { auditLogApi } from '@/api/audit'
import StatusTag from '@/components/StatusTag.vue'
import { formatDateTime } from '@/utils/format'

const loading = ref(false)
const rows = ref<AuditLogVO[]>([])
const total = ref(0)

/**
 * 动作清单 —— 照抄后端 `AuditConstants`，按「端 → 资源」分组。
 * 后端加了新 action 这边下拉里就没有，但筛选框支持手输不了（el-select 不开 allow-create
 * 是刻意的：拼错一个字母筛选结果永远为空，还不如从清单里选）。
 */
const ACTION_GROUPS: { label: string; actions: string[] }[] = [
  { label: '认证', actions: ['ADMIN_LOGIN', 'USER_LOGIN', 'USER_REGISTER', 'ACCESS_DENIED'] },
  {
    label: '用户',
    actions: [
      'USER_CREATE',
      'USER_DELETE',
      'USER_ASSIGN_ROLE',
      'USER_UPDATE_PROFILE',
      'USER_CHANGE_PASSWORD',
    ],
  },
  {
    label: '角色',
    actions: ['ROLE_CREATE', 'ROLE_UPDATE', 'ROLE_DELETE', 'ROLE_ASSIGN_PERMISSION'],
  },
  {
    label: '知识库与文档',
    actions: [
      'KB_CREATE',
      'KB_UPDATE',
      'KB_DELETE',
      'DOCUMENT_UPLOAD',
      'DOCUMENT_DELETE',
      'DOCUMENT_RETRY',
      'DOCUMENT_UPDATE',
    ],
  },
  { label: 'AI', actions: ['AI_CONFIG_CREATE', 'AI_CONFIG_UPDATE', 'AI_CONFIG_DELETE'] },
  {
    label: '简历与岗位',
    actions: [
      'RESUME_CREATE',
      'RESUME_DELETE',
      'RESUME_PARSE',
      'RESUME_OPTIMIZE',
      'JOB_CREATE',
      'JOB_UPDATE',
      'JOB_DELETE',
      'JOB_PARSE',
    ],
  },
  {
    label: '面试',
    actions: [
      'INTERVIEW_CREATE',
      'INTERVIEW_DELETE',
      'INTERVIEW_GENERATE',
      'INTERVIEW_ANSWER',
      'INTERVIEW_FINISH',
    ],
  },
  { label: '会话', actions: ['CONVERSATION_CREATE', 'CONVERSATION_DELETE', 'RAG_FEEDBACK'] },
]

/** 资源类型 —— 同样来自 `AuditConstants` */
const RESOURCE_TYPES = [
  'USER',
  'ROLE',
  'PERMISSION',
  'AI_CONFIG',
  'API',
  'KNOWLEDGE_BASE',
  'DOCUMENT',
  'CONVERSATION',
  'RESUME',
  'JOB',
  'INTERVIEW',
]

/**
 * 查询条件。时间范围用 Date 数组存，发请求时才转 ISO 字符串 ——
 * 后端 `@DateTimeFormat(iso = DATE_TIME)` 要的是 `2026-10-10T00:00:00` 这种本地时间。
 */
const query = reactive({
  page: 1,
  pageSize: 20,
  userId: '',
  action: undefined as string | undefined,
  resourceType: undefined as string | undefined,
  result: undefined as string | undefined,
  range: null as [Date, Date] | null,
  sortBy: undefined as string | undefined,
  sortOrder: undefined as 'asc' | 'desc' | undefined,
})

function fail(e: unknown, fallback: string): void {
  ElMessage.error(e instanceof BizError ? e.message : fallback)
}

/**
 * Date → 本地时间的 ISO 串（`2026-10-10T09:00:00`）。
 *
 * ⚠️ 不能用 `toISOString()` —— 它转成 **UTC**，中国时区会差 8 小时，
 * 筛「今天」会从昨天 16:00 开始。后端 `LocalDateTime` 要的就是无时区的本地时间。
 */
function toLocalIso(d: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  )
}

function asLog(row: unknown): AuditLogVO {
  return row as AuditLogVO
}

async function load(): Promise<void> {
  loading.value = true
  try {
    // userId 是输入框里的字符串：空 → 不筛；非数字也别发给后端（NaN 会变成 "NaN"）
    const userId = query.userId.trim()
    const data = await auditLogApi.page({
      page: query.page,
      pageSize: query.pageSize,
      userId: userId && Number.isFinite(Number(userId)) ? Number(userId) : undefined,
      action: query.action,
      resourceType: query.resourceType,
      result: query.result,
      from: query.range?.[0] ? toLocalIso(query.range[0]) : undefined,
      to: query.range?.[1] ? toLocalIso(query.range[1]) : undefined,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    })
    rows.value = data.records
    total.value = data.total
  } catch (e) {
    fail(e, '加载失败')
  } finally {
    loading.value = false
  }
}

function onSearch(): void {
  query.page = 1
  void load()
}

function onReset(): void {
  query.userId = ''
  query.action = undefined
  query.resourceType = undefined
  query.result = undefined
  query.range = null
  query.sortBy = undefined
  query.sortOrder = undefined
  onSearch()
}

function onSortChange(data: { prop?: string | null; order?: string | null }): void {
  if (!data.order || !data.prop) {
    query.sortBy = undefined
    query.sortOrder = undefined
  } else {
    query.sortBy = data.prop
    query.sortOrder = data.order === 'ascending' ? 'asc' : 'desc'
  }
  query.page = 1
  void load()
}

/**
 * detailJson 后端给的是**字符串**，内容由各业务自己拼，不保证合法 ——
 * parse 得动就格式化好看，parse 不动就原样展示（报错总比丢信息强）。
 */
function prettyDetail(row: AuditLogVO): string {
  if (!row.detailJson) return '（无明细）'
  try {
    return JSON.stringify(JSON.parse(row.detailJson), null, 2)
  } catch {
    return row.detailJson
  }
}

onMounted(load)
</script>

<template>
  <el-card shadow="never">
    <div class="filters">
      <el-select
        v-model="query.action"
        placeholder="动作"
        clearable
        filterable
        class="filters__action"
      >
        <el-option-group v-for="g in ACTION_GROUPS" :key="g.label" :label="g.label">
          <el-option v-for="a in g.actions" :key="a" :label="a" :value="a" />
        </el-option-group>
      </el-select>
      <el-select
        v-model="query.resourceType"
        placeholder="资源类型"
        clearable
        filterable
        class="filters__resource"
      >
        <el-option v-for="t in RESOURCE_TYPES" :key="t" :label="t" :value="t" />
      </el-select>
      <el-select v-model="query.result" placeholder="结果" clearable class="filters__result">
        <el-option label="成功" value="SUCCESS" />
        <el-option label="失败" value="FAIL" />
      </el-select>
      <el-input
        v-model="query.userId"
        placeholder="操作人 ID"
        class="filters__user"
        @keyup.enter="onSearch"
      />
      <el-date-picker
        v-model="query.range"
        type="datetimerange"
        range-separator="至"
        start-placeholder="开始时间"
        end-placeholder="结束时间"
        class="filters__range"
      />
      <el-button type="primary" @click="onSearch">查询</el-button>
      <el-button @click="onReset">重置</el-button>
    </div>

    <!-- 列宽合计 805px + 展开列，最窄视口（1366）下内容区约 1040px -->
    <el-table v-loading="loading" :data="rows" border stripe @sort-change="onSortChange">
      <el-table-column type="expand">
        <template #default="{ row }">
          <div class="detail">
            <p><span class="detail__label">requestId</span>{{ asLog(row).requestId || '-' }}</p>
            <p><span class="detail__label">User-Agent</span>{{ asLog(row).userAgent || '-' }}</p>
            <p>
              <span class="detail__label">明细</span>
            </p>
            <pre class="detail__json">{{ prettyDetail(asLog(row)) }}</pre>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="时间" width="145" sortable="custom">
        <template #default="{ row }">{{ formatDateTime(asLog(row).createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作人" width="90">
        <template #default="{ row }">{{ asLog(row).userId || '-' }}</template>
      </el-table-column>
      <el-table-column prop="action" label="动作" min-width="160" sortable="custom">
        <template #default="{ row }">
          <code class="code">{{ asLog(row).action }}</code>
        </template>
      </el-table-column>
      <el-table-column prop="resourceType" label="资源" min-width="130" sortable="custom">
        <template #default="{ row }">
          <span v-if="asLog(row).resourceType">
            <code class="code">{{ asLog(row).resourceType }}</code>
            <span v-if="asLog(row).resourceId" class="resource-id">
              #{{ asLog(row).resourceId }}
            </span>
          </span>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column label="请求" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">
          <span v-if="asLog(row).httpMethod" class="request">
            <code class="code">{{ asLog(row).httpMethod }}</code>
            {{ asLog(row).requestUri }}
          </span>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column prop="ip" label="IP" width="110" />
      <el-table-column prop="result" label="结果" width="90" align="center" sortable="custom">
        <template #default="{ row }">
          <StatusTag :tone="asLog(row).result === 'SUCCESS' ? 'success' : 'danger'">
            {{ asLog(row).result === 'SUCCESS' ? '成功' : '失败' }}
          </StatusTag>
        </template>
      </el-table-column>
      <template #empty>没有匹配的日志</template>
    </el-table>

    <el-pagination
      v-model:current-page="query.page"
      v-model:page-size="query.pageSize"
      :total="total"
      :page-sizes="[20, 50, 100]"
      layout="total, sizes, prev, pager, next"
      class="pagination"
      @change="() => load()"
    />
  </el-card>
</template>

<style scoped>
/* 筛选项多，窄视口允许折行 */
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--mf-space-3);
  margin-bottom: var(--mf-space-4);
}

.filters__action {
  width: 180px;
}

.filters__resource {
  width: 140px;
}

.filters__result {
  width: 110px;
}

.filters__user {
  width: 120px;
}

.filters__range {
  width: 340px;
}

.code {
  font-family: var(--mf-font-mono, ui-monospace, monospace);
  font-size: var(--mf-font-xs);
  color: var(--mf-text-secondary);
}

.resource-id {
  margin-left: var(--mf-space-1);
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

.request {
  display: inline-flex;
  gap: var(--mf-space-2);
  align-items: center;
}

.detail {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-2);
  padding: var(--mf-space-2) var(--mf-space-6);
  font-size: var(--mf-font-sm);
}

.detail p {
  margin: 0;
  color: var(--mf-text-secondary);
}

.detail__label {
  display: inline-block;
  width: 100px;
  color: var(--mf-text-tertiary);
}

.detail__json {
  padding: var(--mf-space-3);
  margin: 0;
  overflow-x: auto;
  font-family: var(--mf-font-mono, ui-monospace, monospace);
  font-size: var(--mf-font-xs);
  line-height: 1.6;
  color: var(--mf-text-secondary);
  background-color: var(--mf-bg-subtle);
  border-radius: var(--mf-radius-sm);
}

.pagination {
  justify-content: flex-end;
  margin-top: var(--mf-space-4);
}
</style>
