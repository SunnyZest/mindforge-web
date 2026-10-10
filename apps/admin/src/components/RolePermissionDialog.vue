<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { PermissionVO, RoleVO } from '@mindforge/shared'
import { BizError } from '@mindforge/shared'

import { permissionApi } from '@/api/permission'
import { roleApi } from '@/api/role'
import { groupPermissions, groupsOfSide, type PermissionGroup } from '@/utils/permission-group'

const visible = defineModel<boolean>({ required: true })

const props = defineProps<{
  role: RoleVO | null
}>()

const emit = defineEmits<{ saved: [] }>()

const loading = ref(false)
const saving = ref(false)

/** 权限字典（47 条）。基本不变，加载一次就缓存住 */
const allPerms = ref<PermissionVO[]>([])
/** 当前勾选的权限 id */
const selected = ref<number[]>([])
/** 打开时的已选数量 —— 用来判断这次保存是不是「清空」 */
const originalCount = ref(0)

/** 分组逻辑在 utils/permission-group.ts —— 用户详情抽屉也用同一份 */
const groups = computed<PermissionGroup[]>(() => groupPermissions(allPerms.value))

const adminGroups = computed(() => groupsOfSide(groups.value, 'admin'))
const appGroups = computed(() => groupsOfSide(groups.value, 'app'))

const roleName = computed(() => props.role?.name ?? '')

// ---------- 勾选状态 ----------
function idsOf(g: PermissionGroup): number[] {
  return g.items.map((p) => Number(p.id))
}

function isChecked(id: number): boolean {
  return selected.value.includes(id)
}

function toggleOne(id: number, on: boolean): void {
  selected.value = on
    ? [...new Set([...selected.value, id])]
    : selected.value.filter((x) => x !== id)
}

function groupAllChecked(g: PermissionGroup): boolean {
  return g.items.every((p) => isChecked(Number(p.id)))
}

function groupPartial(g: PermissionGroup): boolean {
  const hit = g.items.filter((p) => isChecked(Number(p.id))).length
  return hit > 0 && hit < g.items.length
}

function toggleGroup(g: PermissionGroup, on: boolean): void {
  const ids = idsOf(g)
  selected.value = on
    ? [...new Set([...selected.value, ...ids])]
    : selected.value.filter((x) => !ids.includes(x))
}

function sideIds(gs: PermissionGroup[]): number[] {
  return gs.flatMap(idsOf)
}

function sideAllChecked(gs: PermissionGroup[]): boolean {
  const ids = sideIds(gs)
  return ids.length > 0 && ids.every(isChecked)
}

function sidePartial(gs: PermissionGroup[]): boolean {
  const ids = sideIds(gs)
  const hit = ids.filter(isChecked).length
  return hit > 0 && hit < ids.length
}

function toggleSide(gs: PermissionGroup[], on: boolean): void {
  const ids = sideIds(gs)
  selected.value = on
    ? [...new Set([...selected.value, ...ids])]
    : selected.value.filter((x) => !ids.includes(x))
}

function selectAll(): void {
  selected.value = allPerms.value.map((p) => Number(p.id))
}

function clearAll(): void {
  selected.value = []
}

// ---------- 加载 / 提交 ----------
watch(visible, async (open) => {
  if (!open || !props.role) return

  loading.value = true
  try {
    if (!allPerms.value.length) {
      allPerms.value = await permissionApi.listAll()
    }
    // ⚠️ listPermissions 返回的是该角色【已绑定】的权限，不是全集。
    //    全集在上面的 allPerms 里，这里只拿「哪些该勾上」。
    const assigned = await roleApi.listPermissions(props.role.id)
    selected.value = assigned.map((p) => Number(p.id))
    originalCount.value = selected.value.length
  } catch (e) {
    ElMessage.error(e instanceof BizError ? e.message : '权限加载失败')
  } finally {
    loading.value = false
  }
})

async function submit(): Promise<void> {
  if (!props.role) return

  /**
   * ⚠️ 空数组的语义是【清空】不是【不改】（后端约定），所以从「有」变成「0 项」
   * 是个破坏性操作 —— 该角色的用户会立刻失去这些权限。
   * 只在真的从有到无时拦一下；本来就 0 项的不用拦。
   */
  if (originalCount.value > 0 && selected.value.length === 0) {
    const ok = await ElMessageBox.confirm(
      `这会把「${props.role.name}」原有的 ${originalCount.value} 项权限全部清空，` +
        `绑定该角色的用户会立刻失去这些权限。确定吗？`,
      '确认清空权限',
      { type: 'warning', confirmButtonText: '全部清空' },
    ).catch(() => false)
    if (!ok) return
  }

  saving.value = true
  try {
    await roleApi.assignPermissions(props.role.id, { permissionIds: selected.value })
    ElMessage.success('权限已更新')
    visible.value = false
    emit('saved')
  } catch (e) {
    ElMessage.error(e instanceof BizError ? e.message : '保存失败')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="`分配权限 · ${roleName}`"
    width="720px"
    :close-on-click-modal="false"
    append-to-body
  >
    <div class="bar">
      <span class="bar__count">
        已选 <b>{{ selected.length }}</b> / {{ allPerms.length }} 项
      </span>
      <span class="bar__ops">
        <el-button link type="primary" @click="selectAll">全选</el-button>
        <el-button link @click="clearAll">清空</el-button>
      </span>
    </div>

    <div v-loading="loading" class="panes">
      <!-- 管理端 -->
      <section class="pane">
        <label class="side">
          <el-checkbox
            :model-value="sideAllChecked(adminGroups)"
            :indeterminate="sidePartial(adminGroups)"
            @change="(v) => toggleSide(adminGroups, Boolean(v))"
          >
            <span class="side__text">管理端</span>
          </el-checkbox>
          <span class="side__count">{{ adminGroups.length }} 个模块</span>
        </label>

        <div v-for="g in adminGroups" :key="g.key" class="group">
          <label class="group__head">
            <el-checkbox
              :model-value="groupAllChecked(g)"
              :indeterminate="groupPartial(g)"
              @change="(v) => toggleGroup(g, Boolean(v))"
            >
              <span class="group__text">{{ g.label }}</span>
            </el-checkbox>
            <span class="group__count">
              {{ g.items.filter((p) => isChecked(Number(p.id))).length }}/{{ g.items.length }}
            </span>
          </label>

          <div class="items">
            <el-checkbox
              v-for="p in g.items"
              :key="p.id"
              :model-value="isChecked(Number(p.id))"
              @change="(v) => toggleOne(Number(p.id), Boolean(v))"
            >
              <span class="item__name">{{ p.name }}</span>
              <code class="item__code">{{ p.code }}</code>
            </el-checkbox>
          </div>
        </div>
      </section>

      <!-- 用户端 -->
      <section class="pane">
        <label class="side">
          <el-checkbox
            :model-value="sideAllChecked(appGroups)"
            :indeterminate="sidePartial(appGroups)"
            @change="(v) => toggleSide(appGroups, Boolean(v))"
          >
            <span class="side__text">用户端</span>
          </el-checkbox>
          <span class="side__count">{{ appGroups.length }} 个模块</span>
        </label>

        <div v-for="g in appGroups" :key="g.key" class="group">
          <label class="group__head">
            <el-checkbox
              :model-value="groupAllChecked(g)"
              :indeterminate="groupPartial(g)"
              @change="(v) => toggleGroup(g, Boolean(v))"
            >
              <span class="group__text">{{ g.label }}</span>
            </el-checkbox>
            <span class="group__count">
              {{ g.items.filter((p) => isChecked(Number(p.id))).length }}/{{ g.items.length }}
            </span>
          </label>

          <div class="items">
            <el-checkbox
              v-for="p in g.items"
              :key="p.id"
              :model-value="isChecked(Number(p.id))"
              @change="(v) => toggleOne(Number(p.id), Boolean(v))"
            >
              <span class="item__name">{{ p.name }}</span>
              <code class="item__code">{{ p.code }}</code>
            </el-checkbox>
          </div>
        </div>
      </section>
    </div>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: var(--mf-space-3);
  margin-bottom: var(--mf-space-3);
  border-bottom: 1px solid var(--mf-glass-border-soft);
}

.bar__count {
  font-size: var(--mf-font-sm);
  color: var(--mf-text-secondary);
}

.bar__ops {
  display: flex;
  gap: var(--mf-space-1);
}

/* 两栏并排 —— 47 条权限单列会很长，横着分开放能少滚一半 */
.panes {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--mf-space-4);
  max-height: 56vh;
  overflow-y: auto;
}

.pane {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-3);
}

.side {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--mf-space-2) var(--mf-space-3);
  border-radius: var(--mf-radius-md);
  background-color: var(--mf-primary-subtle);
}

.side__text {
  font-weight: var(--mf-weight-medium);
  color: var(--mf-primary-text);
}

.side__count {
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

.group {
  padding-left: var(--mf-space-2);
}

.group__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.group__text {
  font-weight: var(--mf-weight-medium);
}

.group__count {
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

.items {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--mf-space-1) 0 var(--mf-space-2) var(--mf-space-5);
}

.item__name {
  font-size: var(--mf-font-sm);
}

/* 权限码用等宽字体 —— 它是要被「读」的（排查权限问题时经常对着它看） */
.item__code {
  margin-left: var(--mf-space-2);
  font-family: var(--mf-font-mono, ui-monospace, monospace);
  font-size: 11px;
  color: var(--mf-text-tertiary);
}
</style>
