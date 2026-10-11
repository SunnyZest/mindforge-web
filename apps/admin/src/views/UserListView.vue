<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'

import type { RoleVO, UserSummaryVO } from '@mindforge/shared'
import { BizError } from '@mindforge/shared'

import { roleApi } from '@/api/role'
import { userApi } from '@/api/user'
import StatusTag from '@/components/StatusTag.vue'
import UserDetailDrawer from '@/components/UserDetailDrawer.vue'
import UserFormDialog from '@/components/UserFormDialog.vue'
import UserRoleDialog from '@/components/UserRoleDialog.vue'
import { useAuthStore } from '@/stores/auth'
import { formatDateTime } from '@/utils/format'

const auth = useAuthStore()

const loading = ref(false)
const rows = ref<UserSummaryVO[]>([])
const total = ref(0)

/**
 * 角色列表。三个地方都要用：
 *   ① 新增用户时的角色下拉
 *   ② 分配角色弹窗的候选
 *   ③ 把用户身上的**角色 code** 映射回 **id**（分配角色接口要 id）
 */
const roles = ref<RoleVO[]>([])

/**
 * 查询条件。
 *
 * ⚠️ `status` 用 `undefined` 表示「不筛」，**不能用 0** ——
 * 0 是有意义的取值（禁用）。拿它当「不筛」的话，选「禁用」和「全部」会变成同一个结果。
 */
const query = reactive({
  page: 1,
  pageSize: 10,
  keyword: '',
  status: undefined as number | undefined,
  sortBy: undefined as string | undefined,
  sortOrder: undefined as 'asc' | 'desc' | undefined,
})

// ---------- 弹窗 ----------
const formVisible = ref(false)
/** null = 新增，有值 = 编辑 */
const formUser = ref<UserSummaryVO | null>(null)

const roleVisible = ref(false)
const roleUser = ref<UserSummaryVO | null>(null)

/**
 * 详情抽屉。
 *
 * 为什么用抽屉而不是再加一个「详情」按钮：操作列已经有 4 个按钮了，
 * 再加一个就会把列宽撑破（之前踩过这个坑）。改成**点用户名**打开 ——
 * 不占列宽，而且「点名字看详情」是更自然的直觉。
 */
const detailVisible = ref(false)
const detailUser = ref<UserSummaryVO | null>(null)

function onDetail(row: UserSummaryVO): void {
  detailUser.value = row
  detailVisible.value = true
}

function fail(e: unknown, fallback: string): void {
  ElMessage.error(e instanceof BizError ? e.message : fallback)
}

/**
 * el-table 插槽里的 `row` 类型是 `DefaultRow`（Element Plus 的泛型占位符），
 * 直接传给 `onEdit(row: UserSummaryVO)` 会类型不匹配。
 *
 * 统一在这里转一次，模板里就不用到处写断言 —— 断言散在模板里更容易失控。
 */
function asUser(row: unknown): UserSummaryVO {
  return row as UserSummaryVO
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const data = await userApi.page({
      page: query.page,
      pageSize: query.pageSize,
      // 空串要转成 undefined：否则会拼成 `keyword=` 发过去，
      // 后端拿到的是「空字符串」而不是「没传」，匹配逻辑会不一样
      keyword: query.keyword.trim() || undefined,
      status: query.status,
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

async function loadRoles(): Promise<void> {
  try {
    roles.value = await roleApi.list()
  } catch {
    // 拿不到角色列表不影响「看用户」，只影响新增和分配角色。
    // 这里刻意不弹错 —— 页面一进来就报错会让人以为是列表坏了。
  }
}

function onSearch(): void {
  // 换条件要回到第一页 —— 否则可能停在一个新结果集里不存在的页码上，看到空列表
  query.page = 1
  void load()
}

function onReset(): void {
  query.keyword = ''
  query.status = undefined
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

function onCreate(): void {
  formUser.value = null
  formVisible.value = true
}

function onEdit(row: UserSummaryVO): void {
  formUser.value = row
  formVisible.value = true
}

function onAssignRole(row: UserSummaryVO): void {
  roleUser.value = row
  roleVisible.value = true
}

async function onToggleStatus(row: UserSummaryVO): Promise<void> {
  const next = row.status === 1 ? 0 : 1
  const label = next === 1 ? '启用' : '禁用'

  /**
   * ⚠️ 只有【禁用】需要二次确认。
   *
   * 判断标准是「这个操作能不能自己撤销、有没有破坏性」：
   *   · 禁用 —— 用户立刻登不进来，是破坏性的 → 确认
   *   · 启用 —— 恢复性操作，误点了也无害 → 不确认
   * 一视同仁地都弹确认，只会让人形成「闭眼点确定」的习惯，
   * 那样真危险的确认也就失效了。
   */
  if (next === 0) {
    const ok = await ElMessageBox.confirm(
      `禁用后「${row.username}」将无法登录系统，确定吗？`,
      '确认禁用',
      { type: 'warning', confirmButtonText: '禁用' },
    ).catch(() => false)
    if (!ok) return
  }

  try {
    await userApi.updateStatus(row.id, { status: next })
    ElMessage.success(`已${label}`)
    await load()
  } catch (e) {
    fail(e, `${label}失败`)
  }
}

async function onDelete(row: UserSummaryVO): Promise<void> {
  const ok = await ElMessageBox.confirm(
    `删除后不可恢复，确定删除用户「${row.username}」吗？`,
    '删除确认',
    { type: 'warning', confirmButtonText: '删除' },
  ).catch(() => false)
  if (!ok) return

  try {
    await userApi.remove(row.id)
    ElMessage.success('已删除')
    // 删掉当前页最后一条时要往前退一页，否则会停在一张空页上
    if (rows.value.length === 1 && query.page > 1) query.page -= 1
    await load()
  } catch (e) {
    fail(e, '删除失败')
  }
}

// ---------- 批量操作 ----------
const selectedRows = ref<UserSummaryVO[]>([])
const tableRef = ref()

function onSelectionChange(selection: UserSummaryVO[]): void {
  selectedRows.value = selection
}

function clearSelection(): void {
  tableRef.value?.clearSelection()
  selectedRows.value = []
}

async function onBatchEnable(): Promise<void> {
  if (!selectedRows.value.length) return
  const ids = selectedRows.value.map((r) => r.id)
  try {
    const count = await userApi.batchUpdateStatus({ ids, status: 1 })
    ElMessage.success(`已批量启用 ${count} 个账号`)
    clearSelection()
    await load()
  } catch (e) {
    fail(e, '批量启用失败')
  }
}

async function onBatchDisable(): Promise<void> {
  if (!selectedRows.value.length) return
  const ids = selectedRows.value.map((r) => r.id)
  const ok = await ElMessageBox.confirm(
    `确定批量禁用选中的 ${ids.length} 个用户账号吗？禁用后他们将无法登录系统。`,
    '确认批量禁用',
    { type: 'warning', confirmButtonText: '禁用' },
  ).catch(() => false)
  if (!ok) return

  try {
    const count = await userApi.batchUpdateStatus({ ids, status: 0 })
    ElMessage.success(`已批量禁用 ${count} 个账号`)
    clearSelection()
    await load()
  } catch (e) {
    fail(e, '批量禁用失败')
  }
}

async function onBatchDelete(): Promise<void> {
  if (!selectedRows.value.length) return
  const ids = selectedRows.value.map((r) => r.id)
  const ok = await ElMessageBox.confirm(
    `删除后不可恢复，确定批量删除选中的 ${ids.length} 个用户账号吗？`,
    '高危操作确认',
    { type: 'warning', confirmButtonText: '删除' },
  ).catch(() => false)
  if (!ok) return

  try {
    const count = await userApi.batchRemove({ ids })
    ElMessage.success(`已批量删除 ${count} 个账号`)
    clearSelection()
    await load()
  } catch (e) {
    fail(e, '批量删除失败')
  }
}

onMounted(() => {
  void load()
  void loadRoles()
})
</script>

<template>
  <el-card shadow="never">
    <div class="filters">
      <el-input
        v-model="query.keyword"
        placeholder="用户名 / 昵称"
        clearable
        class="filters__input"
        @keyup.enter="onSearch"
        @clear="onSearch"
      />
      <el-select v-model="query.status" placeholder="状态" clearable class="filters__select">
        <el-option label="启用" :value="1" />
        <el-option label="禁用" :value="0" />
      </el-select>
      <el-button type="primary" @click="onSearch">查询</el-button>
      <el-button @click="onReset">重置</el-button>

      <el-button
        v-if="auth.can('admin:user:create')"
        type="primary"
        class="filters__add"
        @click="onCreate"
      >
        新增用户
      </el-button>
    </div>

    <!-- 批量操作工具栏：仅在有选中项时展示 -->
    <div v-if="selectedRows.length > 0" class="batch-bar">
      <span class="batch-bar__tip">
        已选择 <strong>{{ selectedRows.length }}</strong> 项
      </span>
      <div class="batch-bar__actions">
        <el-button
          v-if="auth.can('admin:user:disable')"
          type="success"
          size="small"
          @click="onBatchEnable"
        >
          批量启用
        </el-button>
        <el-button
          v-if="auth.can('admin:user:disable')"
          type="danger"
          size="small"
          @click="onBatchDisable"
        >
          批量禁用
        </el-button>
        <el-button
          v-if="auth.can('admin:user:delete')"
          type="danger"
          plain
          size="small"
          @click="onBatchDelete"
        >
          批量删除
        </el-button>
        <el-button link size="small" @click="clearSelection">取消选择</el-button>
      </div>
    </div>

    <!-- ⚠️ 列宽要按【最窄的常见视口】算，不是按 1440 算：
         1366×768 的笔记本浏览器最大化后，内容区只有约 1040px。
         所以这里把「创建时间」去掉了（用户列表里它最不重要，
         要看具体时间可以进详情）—— 换来操作列能放下 4 个按钮。
         当前合计 960px，1280 视口也能放下。改列宽时重新加一遍总数。 -->
    <el-table
      ref="tableRef"
      v-loading="loading"
      :data="rows"
      border
      stripe
      @selection-change="onSelectionChange"
      @sort-change="onSortChange"
    >
      <el-table-column type="selection" width="48" align="center" />
      <el-table-column
        prop="username"
        label="用户名"
        min-width="120"
        sortable="custom"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          <!-- 点名字看详情 —— 比再加一个操作按钮省地方，也更符合直觉 -->
          <el-button link type="primary" @click="onDetail(asUser(row))">
            {{ asUser(row).username }}
          </el-button>
        </template>
      </el-table-column>
      <el-table-column prop="nickname" label="昵称" min-width="100" show-overflow-tooltip>
        <template #default="{ row }">{{ row.nickname || '-' }}</template>
      </el-table-column>
      <el-table-column prop="email" label="邮箱" min-width="170" show-overflow-tooltip>
        <template #default="{ row }">{{ row.email || '-' }}</template>
      </el-table-column>
      <el-table-column label="角色" min-width="140">
        <template #default="{ row }">
          <span class="roles">
            <StatusTag v-for="r in row.roles" :key="r" tone="info">{{ r }}</StatusTag>
            <span v-if="!row.roles.length">-</span>
          </span>
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="90" align="center" sortable="custom">
        <template #default="{ row }">
          <StatusTag :tone="row.status === 1 ? 'success' : 'danger'">
            {{ row.status === 1 ? '启用' : '禁用' }}
          </StatusTag>
        </template>
      </el-table-column>
      <el-table-column prop="lastLoginAt" label="最后登录" width="160" sortable="custom">
        <template #default="{ row }">{{ formatDateTime(row.lastLoginAt) }}</template>
      </el-table-column>

      <!-- 操作列宽度按「4 个 link 按钮 + 间距 + 单元格内边距」实测给的，
           不是拍脑袋 —— 205px 会刚好把最后一个按钮切掉。 -->
      <el-table-column label="操作" width="230" fixed="right">
        <template #default="{ row }">
          <span class="actions">
            <el-button
              v-if="auth.can('admin:user:update')"
              link
              type="primary"
              @click="onEdit(asUser(row))"
            >
              编辑
            </el-button>
            <el-button
              v-if="auth.can('admin:user:assign-role')"
              link
              type="primary"
              @click="onAssignRole(asUser(row))"
            >
              角色
            </el-button>
            <el-button
              v-if="auth.can('admin:user:disable')"
              link
              :type="row.status === 1 ? 'warning' : 'success'"
              @click="onToggleStatus(asUser(row))"
            >
              {{ row.status === 1 ? '禁用' : '启用' }}
            </el-button>
            <el-button
              v-if="auth.can('admin:user:delete')"
              link
              type="danger"
              @click="onDelete(asUser(row))"
            >
              删除
            </el-button>
          </span>
        </template>
      </el-table-column>

      <template #empty>没有匹配的用户</template>
    </el-table>

    <el-pagination
      v-model:current-page="query.page"
      v-model:page-size="query.pageSize"
      :total="total"
      :page-sizes="[10, 20, 50]"
      layout="total, sizes, prev, pager, next"
      class="pagination"
      @change="() => load()"
    />

    <UserFormDialog v-model="formVisible" :user="formUser" :roles="roles" @saved="load" />
    <UserRoleDialog v-model="roleVisible" :user="roleUser" :roles="roles" @saved="load" />

    <!-- 抽屉底部的「编辑资料 / 分配角色」直接复用上面两个弹窗，不重复实现 -->
    <UserDetailDrawer
      v-model="detailVisible"
      :user="detailUser"
      @edit="
        (u) => {
          detailVisible = false
          onEdit(u)
        }
      "
      @assign-role="
        (u) => {
          detailVisible = false
          onAssignRole(u)
        }
      "
    />
  </el-card>
</template>

<style scoped>
.filters {
  display: flex;
  gap: var(--mf-space-3);
  margin-bottom: var(--mf-space-4);
}

.filters__input {
  width: 240px;
}

.filters__select {
  width: 140px;
}

/* 「新增」推到最右 —— 它和左边的筛选不是一组操作，挨着放容易误点 */
.filters__add {
  margin-left: auto;
}

.batch-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--mf-space-2) var(--mf-space-4);
  margin-bottom: var(--mf-space-4);
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-7);
  border-radius: var(--mf-radius-md);
}

.batch-bar__tip {
  font-size: var(--mf-font-size-sm);
  color: var(--el-text-color-primary);
}

.batch-bar__tip strong {
  color: var(--el-color-primary);
}

.batch-bar__actions {
  display: inline-flex;
  align-items: center;
  gap: var(--mf-space-2);
}

.roles {
  display: inline-flex;
  flex-wrap: wrap;
  gap: var(--mf-space-1);
}

/* 操作列按钮多，收紧间距 —— 换行会把行高撑起来，表格会显得很散 */
.actions {
  display: inline-flex;
  gap: var(--mf-space-2);
  white-space: nowrap;
}

.pagination {
  justify-content: flex-end;
  margin-top: var(--mf-space-4);
}
</style>
