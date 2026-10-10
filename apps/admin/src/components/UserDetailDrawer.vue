<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { PermissionVO, UserInfoVO, UserSummaryVO } from '@mindforge/shared'
import { BizError } from '@mindforge/shared'
import { Close } from '@element-plus/icons-vue'

import { permissionApi } from '@/api/permission'
import { userApi } from '@/api/user'
import StatusTag from '@/components/StatusTag.vue'
import { groupPermissions, groupsOfSide, type PermissionGroup } from '@/utils/permission-group'
import { formatDateTime } from '@/utils/format'

const visible = defineModel<boolean>({ required: true })

const props = defineProps<{
  /** 列表里那一行的数据 —— 资料字段（邮箱/手机/时间）都来自这里 */
  user: UserSummaryVO | null
}>()

const emit = defineEmits<{
  edit: [user: UserSummaryVO]
  assignRole: [user: UserSummaryVO]
}>()

/**
 * ⚠️ 资料字段和权限来自**两个不同的接口**，不是重复调用：
 *
 *   · 列表行的 `UserSummaryVO` 有 邮箱 / 手机 / 状态 / 注册时间 / 最后登录，
 *     但**没有权限**
 *   · 详情接口的 `UserInfoVO` 有 **`permissions`（有效权限）**，
 *     但只有 id / username / nickname / roles
 *
 * 所以这里两个都用：资料取 props.user，权限去拉一次详情。
 */
const detail = ref<UserInfoVO | null>(null)
const allPerms = ref<PermissionVO[]>([])
const loading = ref(false)

const displayName = computed(() => props.user?.nickname || props.user?.username || '')

/** 头像占位：取昵称/用户名的第一个字符 */
const initial = computed(() => displayName.value.slice(0, 1).toUpperCase() || '?')

const groups = computed<PermissionGroup[]>(() => groupPermissions(allPerms.value))

/** 只保留该用户**确实拥有**的权限，再分组 —— 空模块不显示 */
const ownedGroups = computed(() =>
  groups.value
    .map((g) => ({
      ...g,
      items: g.items.filter((p) => detail.value?.permissions.includes(p.code)),
    }))
    .filter((g) => g.items.length > 0),
)

const ownedAdmin = computed(() => groupsOfSide(ownedGroups.value, 'admin'))
const ownedApp = computed(() => groupsOfSide(ownedGroups.value, 'app'))
const ownedTotal = computed(() => detail.value?.permissions.length ?? 0)

function fail(e: unknown, fallback: string): void {
  ElMessage.error(e instanceof BizError ? e.message : fallback)
}

/**
 * ⚠️ 这里必须同时盯 `user.id`，不能只盯 `visible`。
 *
 * 只盯 visible 的话，抽屉开着的时候换一个人（比如将来加了「上一个/下一个」，
 * 或者列表支持键盘上下切换）数据不会重新拉 —— 会显示上一个人的权限，
 * 而权限错了是很危险的信息（会让人误判该用户有没有某个操作权限）。
 */
watch(
  () => [visible.value, props.user?.id] as const,
  async ([open]) => {
    if (!open || !props.user) return

    loading.value = true
    detail.value = null
    try {
      // 权限字典基本不变，加载一次就缓存住
      if (!allPerms.value.length) {
        allPerms.value = await permissionApi.listAll()
      }
      detail.value = await userApi.detail(props.user.id)
    } catch (e) {
      fail(e, '加载用户详情失败')
    } finally {
      loading.value = false
    }
  },
)
</script>

<template>
  <!--
    ⚠️ append-to-body 不能少 —— 这个抽屉写在 <el-card> 里，
       而卡片有 backdrop-filter + overflow:hidden，
       不加的话抽屉会被卡片裁掉（跟弹窗是同一个坑）。
  -->
  <el-drawer v-model="visible" size="560px" :with-header="false" append-to-body>
    <div v-loading="loading" class="detail">
      <!-- 头部 -->
      <header class="head">
        <span class="head__avatar">{{ initial }}</span>
        <div class="head__main">
          <div class="head__line">
            <span class="head__name">{{ displayName }}</span>
            <StatusTag v-if="user" :tone="user.status === 1 ? 'success' : 'danger'">
              {{ user.status === 1 ? '启用' : '禁用' }}
            </StatusTag>
          </div>
          <span class="head__sub">@{{ user?.username }}</span>
        </div>

        <!--
          自己画一个关闭按钮：抽屉设了 :with-header="false"（用上面的自定义头部
          代替默认标题栏），默认的 X 就没了 —— 只靠点遮罩或按 ESC 关闭，
          用鼠标的人会找不到出口。
        -->
        <el-button class="head__close" link :icon="Close" title="关闭" @click="visible = false" />
      </header>

      <!-- 资料 -->
      <section class="block">
        <h4 class="block__title">基本信息</h4>
        <dl class="fields">
          <div class="fields__row">
            <dt>邮箱</dt>
            <dd>{{ user?.email || '-' }}</dd>
          </div>
          <div class="fields__row">
            <dt>手机号</dt>
            <dd>{{ user?.phone || '-' }}</dd>
          </div>
          <div class="fields__row">
            <dt>注册时间</dt>
            <dd>{{ formatDateTime(user?.createdAt) }}</dd>
          </div>
          <div class="fields__row">
            <dt>最后登录</dt>
            <dd>{{ formatDateTime(user?.lastLoginAt) }}</dd>
          </div>
        </dl>
      </section>

      <!-- 角色 -->
      <section class="block">
        <h4 class="block__title">
          角色
          <span class="block__count">{{ user?.roles.length ?? 0 }} 个</span>
        </h4>
        <div class="tags">
          <StatusTag v-for="r in user?.roles ?? []" :key="r" tone="info">{{ r }}</StatusTag>
          <span v-if="!user?.roles.length" class="empty">该用户没有任何角色</span>
        </div>
        <p class="hint">角色决定权限。这里显示的是角色本身，下面是这些角色**实际带来**的权限。</p>
      </section>

      <!-- 有效权限 -->
      <section class="block">
        <h4 class="block__title">
          有效权限
          <span class="block__count">{{ ownedTotal }} 项</span>
        </h4>

        <p v-if="!loading && ownedTotal === 0" class="empty">
          该用户没有任何权限 —— 检查一下角色是不是被清空了。
        </p>

        <template
          v-for="(sideGroups, side) in { 管理端: ownedAdmin, 用户端: ownedApp }"
          :key="side"
        >
          <div v-if="sideGroups.length" class="side">
            <span class="side__label">{{ side }}</span>
            <div v-for="g in sideGroups" :key="g.key" class="group">
              <span class="group__label">{{ g.label }}</span>
              <div class="tags">
                <StatusTag v-for="p in g.items" :key="p.id" tone="neutral">{{ p.name }}</StatusTag>
              </div>
            </div>
          </div>
        </template>
      </section>
    </div>

    <template #footer>
      <div class="foot">
        <el-button v-if="user" @click="emit('edit', user)">编辑资料</el-button>
        <el-button v-if="user" type="primary" @click="emit('assignRole', user)">
          分配角色
        </el-button>
      </div>
    </template>
  </el-drawer>
</template>

<style scoped>
.detail {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-6);
  min-height: 200px;
}

/* ---------- 头部 ---------- */
.head {
  display: flex;
  gap: var(--mf-space-4);
  align-items: center;
}

.head__avatar {
  display: grid;
  flex: none;
  place-items: center;
  width: 52px;
  height: 52px;
  font-size: 22px;
  font-weight: var(--mf-weight-medium);
  color: #fff;
  background: linear-gradient(160deg, #4a9eff, #0071e3);
  border-radius: var(--mf-radius-lg);
}

.head__main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.head__line {
  display: flex;
  gap: var(--mf-space-2);
  align-items: center;
}

.head__name {
  font-size: var(--mf-font-lg);
  font-weight: var(--mf-weight-medium);
}

.head__sub {
  font-size: var(--mf-font-sm);
  color: var(--mf-text-tertiary);
}

.head__close {
  align-self: flex-start;
  margin-left: auto;
  color: var(--mf-text-tertiary);
}

/* ---------- 区块 ---------- */
.block {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-3);
}

.block__title {
  display: flex;
  gap: var(--mf-space-2);
  align-items: baseline;
  margin: 0;
  font-size: var(--mf-font-sm);
  font-weight: var(--mf-weight-medium);
  color: var(--mf-text-secondary);
}

.block__count {
  font-size: var(--mf-font-xs);
  font-weight: 400;
  color: var(--mf-text-tertiary);
}

/* ---------- 资料字段 ---------- */
.fields {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-2);
  margin: 0;
}

.fields__row {
  display: flex;
  gap: var(--mf-space-4);
  font-size: var(--mf-font-sm);
}

.fields__row dt {
  flex: none;
  width: 72px;
  color: var(--mf-text-tertiary);
}

.fields__row dd {
  margin: 0;
  color: var(--mf-text-primary);
  word-break: break-all;
}

/* ---------- 权限 ---------- */
.side {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-2);
}

.side__label {
  padding: var(--mf-space-1) var(--mf-space-2);
  font-size: var(--mf-font-xs);
  font-weight: var(--mf-weight-medium);
  color: var(--mf-primary-text);
  background-color: var(--mf-primary-subtle);
  border-radius: var(--mf-radius-sm);
}

.group {
  display: flex;
  gap: var(--mf-space-2);
  align-items: baseline;
  padding-left: var(--mf-space-2);
}

.group__label {
  flex: none;
  width: 72px;
  font-size: var(--mf-font-sm);
  color: var(--mf-text-secondary);
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--mf-space-1);
}

.empty {
  font-size: var(--mf-font-sm);
  color: var(--mf-text-tertiary);
}

.hint {
  margin: 0;
  font-size: var(--mf-font-xs);
  line-height: 1.6;
  color: var(--mf-text-tertiary);
}

/* ---------- 底部 ---------- */
.foot {
  display: flex;
  gap: var(--mf-space-2);
  justify-content: flex-end;
}
</style>
