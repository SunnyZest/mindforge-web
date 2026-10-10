<script setup lang="ts">
import { onMounted, ref } from 'vue'

import type { RoleVO } from '@mindforge/shared'
import { BizError } from '@mindforge/shared'

import { roleApi } from '@/api/role'
import RoleFormDialog from '@/components/RoleFormDialog.vue'
import RolePermissionDialog from '@/components/RolePermissionDialog.vue'
import StatusTag from '@/components/StatusTag.vue'
import { useAuthStore } from '@/stores/auth'
import { formatDateTime } from '@/utils/format'

const auth = useAuthStore()

const loading = ref(false)
const rows = ref<RoleVO[]>([])

const formVisible = ref(false)
/** null = 新增 */
const formRole = ref<RoleVO | null>(null)

const permVisible = ref(false)
const permRole = ref<RoleVO | null>(null)

function fail(e: unknown, fallback: string): void {
  ElMessage.error(e instanceof BizError ? e.message : fallback)
}

/** el-table 插槽的 row 是 `DefaultRow`，转成我们的类型 —— 理由同用户列表页 */
function asRole(row: unknown): RoleVO {
  return row as RoleVO
}

/**
 * 角色列表。
 *
 * ⚠️ 这个接口返回的是**数组不是分页** —— 角色总量很少（个位数），后端没做分页。
 *    别照着用户列表那套写分页控件。
 */
async function load(): Promise<void> {
  loading.value = true
  try {
    rows.value = await roleApi.list()
  } catch (e) {
    fail(e, '加载失败')
  } finally {
    loading.value = false
  }
}

function onCreate(): void {
  formRole.value = null
  formVisible.value = true
}

function onEdit(row: RoleVO): void {
  formRole.value = row
  formVisible.value = true
}

function onAssignPermission(row: RoleVO): void {
  permRole.value = row
  permVisible.value = true
}

async function onDelete(row: RoleVO): Promise<void> {
  // 内置角色后端会拒绝删除 —— 前端先把按钮禁掉，别等用户点了才报错。
  // 这里再兜一层，防止将来按钮的 disabled 被误删。
  if (row.builtin) {
    ElMessage.warning('内置角色不允许删除')
    return
  }

  const ok = await ElMessageBox.confirm(
    `删除角色「${row.name}」后，绑定了它的用户会失去对应权限。确定删除吗？`,
    '删除确认',
    { type: 'warning', confirmButtonText: '删除' },
  ).catch(() => false)
  if (!ok) return

  try {
    await roleApi.remove(row.id)
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
      <span class="filters__hint">
        角色决定用户能做什么。改完权限后要等用户<b>下次登录</b>才生效 ——
        权限是登录时随 token 一起下发的，不会实时推送。
      </span>
      <el-button
        v-if="auth.can('admin:role:create')"
        type="primary"
        @click="onCreate"
      >
        新增角色
      </el-button>
    </div>

    <el-table v-loading="loading" :data="rows" border>
      <el-table-column label="名称" min-width="150">
        <template #default="{ row }">
          <span class="name">
            {{ row.name }}
            <span v-if="row.builtin" class="name__builtin">内置</span>
          </span>
        </template>
      </el-table-column>

      <el-table-column prop="code" label="Code" width="150">
        <template #default="{ row }">
          <code class="code">{{ row.code }}</code>
        </template>
      </el-table-column>

      <el-table-column label="描述" min-width="180">
        <template #default="{ row }">{{ row.description || '-' }}</template>
      </el-table-column>

      <el-table-column label="权限数" width="90" align="center">
        <template #default="{ row }">{{ row.permissionCount }}</template>
      </el-table-column>

      <el-table-column label="状态" width="90" align="center">
        <template #default="{ row }">
          <StatusTag :tone="row.status === 1 ? 'success' : 'danger'">
            {{ row.status === 1 ? '启用' : '禁用' }}
          </StatusTag>
        </template>
      </el-table-column>

      <el-table-column label="创建时间" width="160">
        <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
      </el-table-column>

      <el-table-column label="操作" width="170" fixed="right">
        <template #default="{ row }">
          <span class="actions">
            <el-button
              v-if="auth.can('admin:role:update')"
              link
              type="primary"
              @click="onEdit(asRole(row))"
            >
              编辑
            </el-button>
            <el-button
              v-if="auth.can('admin:role:assign-permission')"
              link
              type="primary"
              @click="onAssignPermission(asRole(row))"
            >
              权限
            </el-button>
            <el-button
              v-if="auth.can('admin:role:delete')"
              link
              type="danger"
              :disabled="row.builtin"
              :title="row.builtin ? '内置角色不允许删除' : ''"
              @click="onDelete(asRole(row))"
            >
              删除
            </el-button>
          </span>
        </template>
      </el-table-column>

      <template #empty>还没有角色</template>
    </el-table>

    <RoleFormDialog v-model="formVisible" :role="formRole" @saved="load" />
    <RolePermissionDialog v-model="permVisible" :role="permRole" @saved="load" />
  </el-card>
</template>

<style scoped>
.filters {
  display: flex;
  gap: var(--mf-space-4);
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--mf-space-4);
}

.filters__hint {
  font-size: var(--mf-font-sm);
  line-height: 1.5;
  color: var(--mf-text-tertiary);
}

.name {
  display: inline-flex;
  gap: var(--mf-space-2);
  align-items: center;
}

.name__builtin {
  padding: 0 var(--mf-space-2);
  font-size: 11px;
  color: var(--mf-info-text);
  background-color: var(--mf-info-subtle);
  border-radius: var(--mf-radius-pill);
}

.code {
  font-family: var(--mf-font-mono, ui-monospace, monospace);
  font-size: var(--mf-font-xs);
  color: var(--mf-text-secondary);
}

.actions {
  display: inline-flex;
  gap: var(--mf-space-2);
  white-space: nowrap;
}
</style>
