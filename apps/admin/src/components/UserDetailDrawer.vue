<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { AdminUserDetailVO, PermissionVO, UserSummaryVO } from '@mindforge/shared'
import { BizError } from '@mindforge/shared'
import { Close } from '@element-plus/icons-vue'

import { permissionApi } from '@/api/permission'
import { userApi } from '@/api/user'
import StatusTag from '@/components/StatusTag.vue'
import { groupPermissions, groupsOfSide, type PermissionGroup } from '@/utils/permission-group'
import { formatBytes, formatCount, formatDateTime } from '@/utils/format'

const visible = defineModel<boolean>({ required: true })

const props = defineProps<{
  /** 列表里那一行的数据 —— 只在详情回来之前用来兜住头部与基础字段 */
  user: UserSummaryVO | null
}>()

const emit = defineEmits<{
  edit: [user: UserSummaryVO]
  assignRole: [user: UserSummaryVO]
}>()

/**
 * 详情接口（`AdminUserDetailVO`）**一个请求就把所有字段给全了** ——
 * 基础资料、角色明细、有效权限、登录安全、资源占用都在里面。
 *
 * ⚠️ 这里曾经要「列表行 + 详情」两个数据源拼：那时详情返回的是用户端的
 *    `UserInfoVO`，字段比列表还少（只有 id / 用户名 / 昵称 / 角色 / 权限）。
 *    后端补了 `AdminUserDetailVO` 之后不需要了，但**别把列表行删掉** ——
 *    抽屉打开的那一瞬间详情还没回来，头部要靠它撑着，否则先闪一屏空白。
 */
const detail = ref<AdminUserDetailVO | null>(null)
const allPerms = ref<PermissionVO[]>([])
const loading = ref(false)

/** 基础资料：详情到了用详情，没到先用列表行兜住 */
const profile = computed(() => {
  const d = detail.value
  const u = props.user
  return {
    username: d ? d.username : (u?.username ?? ''),
    nickname: d ? d.nickname : (u?.nickname ?? null),
    email: d ? d.email : (u?.email ?? null),
    phone: d ? d.phone : (u?.phone ?? null),
    status: d ? d.status : (u?.status ?? 0),
    createdAt: d ? d.createdAt : (u?.createdAt ?? null),
    lastLoginAt: d ? d.lastLoginAt : (u?.lastLoginAt ?? null),
  }
})

const displayName = computed(() => profile.value.nickname || profile.value.username || '')

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

/**
 * 角色明细。
 *
 * ⚠️ 两个字段并存是后端刻意的：`roles` 是角色 code 数组（与列表接口同形，
 *    前端拿它做判断），`roleItems` 才带角色名。详情页要显示给人看，用后者；
 *    详情还没回来时退回 code，至少不至于空着。
 */
const roleItems = computed(() => {
  const d = detail.value
  if (d) return d.roleItems.map((r) => ({ key: r.roleId, name: r.roleName, code: r.roleCode }))
  return (props.user?.roles ?? []).map((code) => ({ key: code, name: code, code }))
})

const roleCount = computed(() =>
  detail.value ? detail.value.roleItems.length : roleItems.value.length,
)

/** 资源占用：详情才有，全 0 也要显示（0 本身是有效信息） */
const resourceCells = computed(() => {
  const d = detail.value
  if (!d) return []
  return [
    { key: 'kb', label: '知识库', value: formatCount(d.knowledgeBaseCount) },
    { key: 'doc', label: '文档', value: formatCount(d.documentCount) },
    { key: 'resume', label: '简历', value: formatCount(d.resumeCount) },
    { key: 'interview', label: '模拟面试', value: formatCount(d.interviewCount) },
    { key: 'job', label: '职位', value: formatCount(d.jobCount) },
    { key: 'storage', label: '存储占用', value: formatBytes(d.storageBytes) },
  ]
})

/** 剩余锁定秒数 → 人话。0 表示没锁 */
const lockText = computed(() => {
  const seconds = detail.value?.loginLockRemainingSeconds ?? 0
  if (seconds <= 0) return '未锁定'
  const minutes = Math.ceil(seconds / 60)
  return `已锁定，剩余 ${minutes} 分钟`
})

const locked = computed(() => (detail.value?.loginLockRemainingSeconds ?? 0) > 0)

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
            <StatusTag :tone="profile.status === 1 ? 'success' : 'danger'">
              {{ profile.status === 1 ? '启用' : '禁用' }}
            </StatusTag>
            <StatusTag v-if="locked" tone="warning">锁定中</StatusTag>
          </div>
          <span class="head__sub">@{{ profile.username }}</span>
        </div>

        <!--
          自己画一个关闭按钮：抽屉设了 :with-header="false"（用上面的自定义头部
          代替默认标题栏），默认的 X 就没了 —— 只靠点遮罩或按 ESC 关闭，
          用鼠标的人会找不到出口。
        -->
        <el-button class="head__close" link :icon="Close" title="关闭" @click="visible = false" />
      </header>

      <!-- 基本信息 -->
      <section class="block">
        <h4 class="block__title">基本信息</h4>
        <dl class="fields">
          <div class="fields__row">
            <dt>邮箱</dt>
            <dd>{{ profile.email || '-' }}</dd>
          </div>
          <div class="fields__row">
            <dt>手机号</dt>
            <dd>{{ profile.phone || '-' }}</dd>
          </div>
          <div class="fields__row">
            <dt>注册时间</dt>
            <dd>{{ formatDateTime(profile.createdAt) }}</dd>
          </div>
          <div class="fields__row">
            <dt>最后登录</dt>
            <dd>{{ formatDateTime(profile.lastLoginAt) }}</dd>
          </div>
          <div class="fields__row">
            <dt>登录 IP</dt>
            <dd>{{ detail?.lastLoginIp || '-' }}</dd>
          </div>
        </dl>
      </section>

      <!-- 登录安全 -->
      <section v-if="detail" class="block">
        <h4 class="block__title">登录安全</h4>
        <dl class="fields">
          <div class="fields__row">
            <dt>失败次数</dt>
            <dd>
              {{ detail.failedLoginCount }} 次
              <span v-if="detail.failedLoginCount > 0" class="fields__note">
                （当前窗口内，登录成功即清零）
              </span>
            </dd>
          </div>
          <div class="fields__row">
            <dt>账号状态</dt>
            <dd>
              <StatusTag :tone="locked ? 'warning' : 'success'">{{ lockText }}</StatusTag>
            </dd>
          </div>
        </dl>
      </section>

      <!-- 资源占用 -->
      <section v-if="detail" class="block">
        <h4 class="block__title">
          资源占用
          <span class="block__count">存储只算未删除的文件</span>
        </h4>
        <div class="stats">
          <div v-for="c in resourceCells" :key="c.key" class="stats__cell">
            <span class="stats__value">{{ c.value }}</span>
            <span class="stats__label">{{ c.label }}</span>
          </div>
        </div>
      </section>

      <!-- 角色 -->
      <section class="block">
        <h4 class="block__title">
          角色
          <span class="block__count">{{ roleCount }} 个</span>
        </h4>
        <div class="tags">
          <StatusTag v-for="r in roleItems" :key="r.key" tone="info" :title="r.code">
            {{ r.name }}
          </StatusTag>
          <span v-if="!roleItems.length" class="empty">该用户没有任何角色</span>
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

.fields__note {
  color: var(--mf-text-tertiary);
}

/* ---------- 资源占用 ---------- */
.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--mf-space-2);
}

.stats__cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--mf-space-3);
  background-color: var(--mf-bg-subtle);
  border-radius: var(--mf-radius-md);
}

.stats__value {
  font-size: var(--mf-font-lg);
  font-weight: var(--mf-weight-medium);
  color: var(--mf-text-primary);
  font-variant-numeric: tabular-nums;
}

.stats__label {
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
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
