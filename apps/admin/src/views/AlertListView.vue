<script setup lang="ts">
import { Check, CopyDocument, Refresh } from '@element-plus/icons-vue'
import { onMounted, reactive, ref } from 'vue'

import { BizError, formatDateTime, type AdminAlertQuery, type AdminAlertVO } from '@mindforge/shared'

import { alertApi } from '@/api/alert'

const loading = ref(false)
const markingAll = ref(false)
const rows = ref<AdminAlertVO[]>([])
const total = ref(0)

/**
 * 查询条件。
 * 默认进入看「只看未读」，便于管理员第一时间处置高危动作。
 */
const query = reactive<{
  page: number
  pageSize: number
  unreadOnly: boolean
  sortBy: NonNullable<AdminAlertQuery['sortBy']>
  sortOrder: NonNullable<AdminAlertQuery['sortOrder']>
}>({
  page: 1,
  pageSize: 20,
  unreadOnly: true,
  sortBy: 'createdAt',
  sortOrder: 'desc',
})

function fail(e: unknown, fallback: string): void {
  ElMessage.error(e instanceof BizError ? e.message : fallback)
}

/** el-table 插槽的 row 是 DefaultRow 类型，统一转换防类型丢失 */
function asAlert(row: unknown): AdminAlertVO {
  return row as AdminAlertVO
}

/** 格式化明细 JSON，解析失败时安全回落到原文本 */
function formatJson(raw: string | null): string {
  if (!raw) return '无明细数据'
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const data = await alertApi.page({
      page: query.page,
      pageSize: query.pageSize,
      unreadOnly: query.unreadOnly ? true : undefined,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    })
    rows.value = data.records
    total.value = data.total
  } catch (e) {
    fail(e, '加载高危告警失败')
  } finally {
    loading.value = false
  }
}

/** 标记单条已读（恢复性操作，无需二次确认） */
async function onMarkRead(alert: AdminAlertVO): Promise<void> {
  try {
    await alertApi.markRead(alert.id)
    alert.read = true
    alert.readAt = new Date().toISOString()
    ElMessage.success('已标记为已读')
  } catch (e) {
    fail(e, '标记已读失败')
  }
}

/** 全部标记已读（恢复性操作，符合危险操作才加确认的约定） */
async function onMarkAllRead(): Promise<void> {
  markingAll.value = true
  try {
    const count = await alertApi.markAllRead()
    ElMessage.success(`已将 ${count} 条告警标记为已读`)
    await load()
  } catch (e) {
    fail(e, '标记全部已读失败')
  } finally {
    markingAll.value = false
  }
}

/** 复制 traceId 便于运维排查与回溯 */
async function copyRequestId(id: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(id)
    ElMessage.success('TraceId 已复制到剪贴板')
  } catch {
    ElMessage.info(`TraceId: ${id}`)
  }
}

function onReset(): void {
  query.page = 1
  query.unreadOnly = false
  query.sortBy = 'createdAt'
  query.sortOrder = 'desc'
  void load()
}

onMounted(() => {
  void load()
})
</script>

<template>
  <el-card class="alert-page">
    <!-- 头部工具栏与筛选 -->
    <div class="toolbar">
      <div class="toolbar__filters">
        <el-switch
          v-model="query.unreadOnly"
          active-text="只看未读"
          inactive-text="全部"
          @change="
            () => {
              query.page = 1
              load()
            }
          "
        />

        <div class="filter-item">
          <span class="filter-label">排序:</span>
          <el-select
            v-model="query.sortBy"
            placeholder="排序字段"
            style="width: 130px"
            @change="
              () => {
                query.page = 1
                load()
              }
            "
          >
            <el-option label="发生时间" value="createdAt" />
            <el-option label="操作动作" value="action" />
            <el-option label="资源类型" value="resourceType" />
          </el-select>
        </div>

        <el-select
          v-model="query.sortOrder"
          style="width: 100px"
          @change="
            () => {
              query.page = 1
              load()
            }
          "
        >
          <el-option label="降序" value="desc" />
          <el-option label="升序" value="asc" />
        </el-select>

        <el-button :icon="Refresh" @click="onReset">重置</el-button>
      </div>

      <div class="toolbar__actions">
        <el-button
          type="primary"
          plain
          :icon="Check"
          :loading="markingAll"
          @click="onMarkAllRead"
        >
          全部已读
        </el-button>
      </div>
    </div>

    <!--
      表格列宽预算（基于最窄视口 1366x768 内容区 1040px 计算）：
      展开(48) + 状态(80) + 标题(220) + 动作(180) + 资源(140) + 操作人(110) + 时间(160) + 操作(90) = 1028px
      合计 1028px <= 1040px，避免横向滚动导致右侧固定操作列遮挡内容
    -->
    <el-table v-loading="loading" :data="rows" row-key="id" class="alert-table">
      <!-- 展开明细行 -->
      <el-table-column type="expand" width="48">
        <template #default="{ row }">
          <div class="expand-pane">
            <div class="expand-grid">
              <div class="expand-item">
                <span class="expand-label">TraceId:</span>
                <span v-if="asAlert(row).requestId" class="trace-id">
                  <code>{{ asAlert(row).requestId }}</code>
                  <el-button
                    link
                    type="primary"
                    :icon="CopyDocument"
                    @click="copyRequestId(asAlert(row).requestId!)"
                  />
                </span>
                <span v-else class="text-muted">-</span>
              </div>

              <div class="expand-item">
                <span class="expand-label">触发人 ID:</span>
                <span>{{ asAlert(row).userId ? `#${asAlert(row).userId}` : '系统自动触发' }}</span>
              </div>

              <div class="expand-item">
                <span class="expand-label">已读信息:</span>
                <span v-if="asAlert(row).read">
                  {{ formatDateTime(asAlert(row).readAt) }}
                  <template v-if="asAlert(row).readBy"> (管理员 #{{ asAlert(row).readBy }})</template>
                </span>
                <span v-else class="text-warning">未读</span>
              </div>
            </div>

            <div class="expand-json">
              <span class="expand-label">操作明细 (Detail JSON):</span>
              <pre class="json-box">{{ formatJson(asAlert(row).detailJson) }}</pre>
            </div>
          </div>
        </template>
      </el-table-column>

      <!-- 已读状态 -->
      <el-table-column label="状态" width="80" align="center">
        <template #default="{ row }">
          <el-tag v-if="!asAlert(row).read" type="danger" size="small" effect="dark">未读</el-tag>
          <el-tag v-else type="info" size="small">已读</el-tag>
        </template>
      </el-table-column>

      <!-- 告警标题 -->
      <el-table-column label="告警标题" min-width="220" show-overflow-tooltip>
        <template #default="{ row }">
          <span
            class="alert-title"
            :class="{ 'alert-title--fail': asAlert(row).title.includes('失败') }"
          >
            {{ asAlert(row).title }}
          </span>
        </template>
      </el-table-column>

      <!-- 高危操作 -->
      <el-table-column prop="action" label="操作类型" width="180">
        <template #default="{ row }">
          <code class="action-tag">{{ asAlert(row).action }}</code>
        </template>
      </el-table-column>

      <!-- 资源类型与 ID -->
      <el-table-column label="关联资源" width="140" show-overflow-tooltip>
        <template #default="{ row }">
          <span v-if="asAlert(row).resourceType">
            {{ asAlert(row).resourceType }}
            <template v-if="asAlert(row).resourceId">/{{ asAlert(row).resourceId }}</template>
          </span>
          <span v-else class="text-muted">-</span>
        </template>
      </el-table-column>

      <!-- 操作人 -->
      <el-table-column label="操作人" width="110">
        <template #default="{ row }">
          <span>{{ asAlert(row).userId ? `用户 #${asAlert(row).userId}` : '系统触发' }}</span>
        </template>
      </el-table-column>

      <!-- 发生时间 -->
      <el-table-column label="发生时间" width="160">
        <template #default="{ row }">
          <span>{{ formatDateTime(asAlert(row).createdAt) }}</span>
        </template>
      </el-table-column>

      <!-- 行内操作 -->
      <el-table-column label="操作" width="90" fixed="right" align="center">
        <template #default="{ row }">
          <el-button
            v-if="!asAlert(row).read"
            link
            type="primary"
            size="small"
            @click="onMarkRead(asAlert(row))"
          >
            标为已读
          </el-button>
          <span v-else class="text-muted">已处理</span>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <div class="pagination">
      <el-pagination
        v-model:current-page="query.page"
        v-model:page-size="query.pageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @current-change="() => load()"
        @size-change="
          () => {
            query.page = 1
            load()
          }
        "
      />
    </div>
  </el-card>
</template>

<style scoped>
.alert-page {
  border-radius: var(--mf-radius-lg);
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--mf-space-3);
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--mf-space-4);
}

.toolbar__filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--mf-space-3);
  align-items: center;
}

.filter-item {
  display: flex;
  gap: var(--mf-space-1);
  align-items: center;
}

.filter-label {
  font-size: var(--mf-font-sm);
  color: var(--mf-text-secondary);
}

.alert-table {
  width: 100%;
}

.alert-title {
  font-weight: var(--mf-weight-medium);
}

.alert-title--fail {
  color: var(--mf-danger);
}

.action-tag {
  padding: 2px 6px;
  font-size: var(--mf-font-xs);
  background-color: var(--mf-bg-subtle);
  border-radius: var(--mf-radius-sm);
  border: 1px solid var(--mf-glass-border-soft);
}

.text-muted {
  color: var(--mf-text-tertiary);
}

.text-warning {
  color: var(--mf-warning);
}

/* 展开行样式 */
.expand-pane {
  padding: var(--mf-space-3) var(--mf-space-5);
  background-color: var(--mf-bg-subtle);
  border-radius: var(--mf-radius-md);
}

.expand-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--mf-space-3);
  margin-bottom: var(--mf-space-3);
}

.expand-item {
  display: flex;
  gap: var(--mf-space-2);
  align-items: center;
  font-size: var(--mf-font-sm);
}

.expand-label {
  font-size: var(--mf-font-xs);
  color: var(--mf-text-secondary);
}

.trace-id {
  display: inline-flex;
  gap: var(--mf-space-1);
  align-items: center;
}

.trace-id code {
  padding: 1px 4px;
  font-size: var(--mf-font-xs);
  background: var(--mf-bg-surface);
  border-radius: var(--mf-radius-sm);
}

.expand-json {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-1);
}

.json-box {
  max-height: 240px;
  margin: 0;
  padding: var(--mf-space-3);
  overflow-y: auto;
  font-size: var(--mf-font-xs);
  font-family: monospace;
  line-height: 1.5;
  background-color: var(--mf-bg-surface);
  border: 1px solid var(--mf-glass-border-soft);
  border-radius: var(--mf-radius-sm);
  white-space: pre-wrap;
  word-break: break-all;
}

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--mf-space-4);
}
</style>
