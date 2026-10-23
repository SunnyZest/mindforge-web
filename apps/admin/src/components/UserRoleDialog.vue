<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { RoleVO, UserSummaryVO } from '@mindforge/shared'
import { BizError } from '@mindforge/shared'

import { userApi } from '@/api/user'

const visible = defineModel<boolean>({ required: true })

const props = defineProps<{
  user: UserSummaryVO | null
  roles: RoleVO[]
}>()

const emit = defineEmits<{ saved: [] }>()

const selected = ref<string[]>([])
/** 打开时的角色数量 —— 用来判断这次保存是不是「清空」 */
const originalCount = ref(0)
const saving = ref(false)

const userName = computed(() => props.user?.nickname || props.user?.username || '')

/** 选中角色的 code 列表 —— 判断「只有管理端角色、没有用户端角色」用 */
const selectedCodes = computed(() =>
  props.roles.filter((r) => selected.value.includes(r.id)).map((r) => r.code),
)

/**
 * 只挂了 ADMIN、没挂 USER 时提示。
 *
 * ★ 不自动帮用户勾上 USER：那会顺手多给 31 个用户端权限，破坏最小权限。
 *   这里只提示，让分配者自己决定。
 * ★ SUPER_ADMIN 不提示 —— 它绑了全部权限码（含 app:*），本来就能用用户端。
 */
const adminWithoutUser = computed(
  () =>
    selectedCodes.value.includes('ADMIN') &&
    !selectedCodes.value.includes('USER') &&
    !selectedCodes.value.includes('SUPER_ADMIN'),
)

/**
 * ★ 这个页面最容易踩的地方：
 *
 *   用户列表返回的 `roles` 是**角色 code 数组**（如 `['ADMIN']`），
 *   但分配角色的接口要的是 **id 数组**（`AssignRolesDTO.roleIds`）。
 *
 *   所以必须拿 code 去角色列表里查出对应的 id —— 不能把 `roles` 直接丢过去，
 *   那样类型对不上，运行时也会绑错。
 */
watch(visible, (open) => {
  if (!open) return
  const codes = props.user?.roles ?? []
  selected.value = props.roles.filter((r) => codes.includes(r.code)).map((r) => r.id)
  originalCount.value = selected.value.length
})

async function submit(): Promise<void> {
  if (!props.user) return

  /**
   * ⚠️ `roleIds: []` 的语义是【清空】不是【不改】（后端约定），
   * 所以从「有角色」变成「0 个角色」是破坏性操作。
   * 只在真的从有到无时拦一下。
   */
  if (originalCount.value > 0 && selected.value.length === 0) {
    const ok = await ElMessageBox.confirm(
      `这会把「${userName.value}」原有的 ${originalCount.value} 个角色全部清空，` +
        `该用户会失去这些角色带来的权限。确定吗？`,
      '确认清空角色',
      { type: 'warning', confirmButtonText: '全部清空' },
    ).catch(() => false)
    if (!ok) return
  }

  saving.value = true
  try {
    await userApi.assignRoles(props.user.id, { roleIds: selected.value })
    ElMessage.success(selected.value.length ? '已更新角色' : '已清空该用户的全部角色')
    visible.value = false
    emit('saved')
  } catch (e) {
    ElMessage.error(e instanceof BizError ? e.message : '分配角色失败')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    title="分配角色"
    width="min(440px, 92vw)"
    :close-on-click-modal="false"
    append-to-body
  >
    <p class="who">
      给 <b>{{ userName }}</b> 分配角色：
    </p>

    <el-checkbox-group v-model="selected" class="role-list">
      <!-- ⚠️ 外层用 div 不是 label：el-checkbox 自己会渲染一个 <label>，
           嵌套 label 是非法 HTML，浏览器会把点击行为搞得莫名其妙 -->
      <div v-for="r in props.roles" :key="r.id" class="role">
        <el-checkbox :value="r.id" :disabled="r.status !== 1">
          <span class="role__name">{{ r.name }}</span>
          <code class="role__code">{{ r.code }}</code>
          <span class="role__meta">{{ r.permissionCount }} 项权限</span>
          <span v-if="r.builtin" class="role__builtin">内置</span>
          <span v-if="r.status !== 1" class="role__off">已禁用</span>
        </el-checkbox>
      </div>
    </el-checkbox-group>

    <!-- 空数组是「清空」不是「不改」—— 这个语义太反直觉，必须显式警告 -->
    <el-alert
      v-if="!selected.length"
      type="warning"
      :closable="false"
      show-icon
      title="一个都不选 = 清空该用户的全部角色"
    />

    <!-- 只给管理端角色：能进管理端，但用户端每个接口都会 403 -->
    <el-alert
      v-if="adminWithoutUser"
      type="warning"
      :closable="false"
      show-icon
      title="该账号将无法使用用户端"
      description="只分配 ADMIN 时，登录用户端会全部 403。如需使用用户端，请同时勾选 USER。"
    />

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.who {
  margin: 0 0 var(--mf-space-4);
  font-size: var(--mf-font-sm);
  color: var(--mf-text-secondary);
}

.role-list {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-2);
  width: 100%;
  margin-bottom: var(--mf-space-4);
}

.role {
  display: block;
  padding: var(--mf-space-2) var(--mf-space-3);
  border: 1px solid var(--mf-glass-border-soft);
  border-radius: var(--mf-radius-md);
  background-color: var(--mf-glass-tint);
  cursor: pointer;
  transition: border-color var(--mf-duration-fast) var(--mf-ease-out);
}

.role:hover {
  border-color: var(--mf-border-strong);
}

.role__name {
  font-weight: var(--mf-weight-medium);
}

.role__code {
  margin-left: var(--mf-space-2);
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

.role__meta {
  margin-left: var(--mf-space-3);
  font-size: var(--mf-font-xs);
  color: var(--mf-text-secondary);
}

.role__builtin,
.role__off {
  margin-left: var(--mf-space-2);
  padding: 0 var(--mf-space-2);
  font-size: 11px;
  border-radius: var(--mf-radius-pill);
}

.role__builtin {
  color: var(--mf-info-text);
  background-color: var(--mf-info-subtle);
}

.role__off {
  color: var(--mf-danger-text);
  background-color: var(--mf-danger-subtle);
}
</style>
