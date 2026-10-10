<script setup lang="ts">
import { Plus, Edit, Delete, Check, RefreshLeft, View } from '@element-plus/icons-vue'
import { computed, onMounted, ref } from 'vue'

import { BizError, formatDateTime, type PromptGroupVO, type PromptVO } from '@mindforge/shared'

import { promptApi } from '@/api/prompt'
import PromptEditDialog from '@/components/PromptEditDialog.vue'

const loading = ref(false)
const groups = ref<PromptGroupVO[]>([])
/** 本地筛场景 —— 不用后端的 ?scene=（过滤后场景下拉的选项就没了，见 api/prompt.ts 的说明） */
const sceneFilter = ref('')

const dialogVisible = ref(false)
const editingVersion = ref<PromptVO | null>(null)
const editingGroup = ref<PromptGroupVO | null>(null)

/** 正在处理的版本 id（按钮 loading） */
const acting = ref<string | null>(null)

/** 详情预览（正文太长，列表里放不下） */
const viewVisible = ref(false)
const viewing = ref<PromptVO | null>(null)

function fail(e: unknown, fallback: string): void {
  ElMessage.error(e instanceof BizError ? e.message : fallback)
}

async function load(): Promise<void> {
  loading.value = true
  try {
    groups.value = await promptApi.list()
  } catch (e) {
    fail(e, '加载失败')
  } finally {
    loading.value = false
  }
}

/** 场景下拉的选项从数据里推 —— 不硬编码枚举，后端加场景这里自动就有 */
const scenes = computed(() => [...new Set(groups.value.map((g) => g.scene))].sort())

const filtered = computed(() =>
  sceneFilter.value ? groups.value.filter((g) => g.scene === sceneFilter.value) : groups.value,
)

/** 某个版本是不是当前生效的 */
function isActive(v: PromptVO): boolean {
  return v.status === 'PUBLISHED'
}

// ---------- 操作 ----------
function onCreateGroup(): void {
  editingVersion.value = null
  editingGroup.value = null
  dialogVisible.value = true
}

function onAddVersion(g: PromptGroupVO): void {
  editingVersion.value = null
  editingGroup.value = g
  dialogVisible.value = true
}

function onEdit(v: PromptVO): void {
  editingVersion.value = v
  editingGroup.value = null
  dialogVisible.value = true
}

function onView(v: PromptVO): void {
  viewing.value = v
  viewVisible.value = true
}

/**
 * 启用这一版。
 * ★ 后端有 publish 和 rollback 两个接口，但语义是同一件事：
 *   「让这一版生效，原来那版归档」。所以界面上就一个按钮，别让用户去分辨。
 */
async function onActivate(v: PromptVO): Promise<void> {
  acting.value = v.id
  try {
    // 已归档的走 rollback，草稿走 publish —— 后端区分了，前端跟着走
    if (v.status === 'ARCHIVED') await promptApi.rollback(v.id)
    else await promptApi.publish(v.id)
    ElMessage.success(`v${v.version} 已生效`)
    await load()
  } catch (e) {
    fail(e, '操作失败')
  } finally {
    acting.value = null
  }
}

async function onRemove(v: PromptVO): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除 v${v.version}？删了就找不回来了。`, '删除版本', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }

  try {
    await promptApi.remove(v.id)
    ElMessage.success('已删除')
    await load()
  } catch (e) {
    fail(e, '删除失败')
  }
}

/**
 * ⚠️ 键是**大写** —— 后端返回的就是 DRAFT / PUBLISHED / ARCHIVED。
 *    写成小写的话徽章会显示英文原值，而且 isActive() 永远为 false，
 *    导致「生效中的版本不能删」这条保护失效（实测踩过）。
 */
const STATUS_TEXT: Record<string, string> = {
  PUBLISHED: '生效中',
  DRAFT: '草稿',
  ARCHIVED: '已归档',
}

onMounted(load)
</script>

<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">Prompt 管理</h1>
        <p class="page__sub">按「场景 → 变体 → 版本」组织。只有生效中的那个版本会被真正使用。</p>
      </div>

      <div class="page__actions">
        <el-select v-model="sceneFilter" placeholder="全部场景" clearable class="page__filter">
          <el-option v-for="s in scenes" :key="s" :label="s" :value="s" />
        </el-select>
        <el-button type="primary" :icon="Plus" @click="onCreateGroup">新建变体</el-button>
      </div>
    </header>

    <div v-loading="loading" class="list">
      <article v-for="g in filtered" :key="`${g.scene}/${g.name}`" class="group">
        <div class="group__head">
          <div class="group__main">
            <div class="group__title">
              <span class="group__name">{{ g.name }}</span>
              <span class="group__scene">{{ g.scene }}</span>
              <span v-if="g.isDefault" class="badge badge--primary">默认</span>
              <span v-if="g.userSelectable" class="badge">用户可选</span>
            </div>
            <p class="group__meta">
              <span v-if="g.label">选项名「{{ g.label }}」 · </span>
              共 {{ g.versions.length }} 个版本
              <template v-if="g.latestVersion !== null"> · 最新 v{{ g.latestVersion }}</template>
            </p>
          </div>

          <el-button size="small" :icon="Plus" @click="onAddVersion(g)">加新版本</el-button>
        </div>

        <div class="versions">
          <div
            v-for="v in g.versions"
            :key="v.id"
            class="ver"
            :class="{ 'ver--active': isActive(v) }"
          >
            <span class="ver__no">v{{ v.version }}</span>

            <span class="badge" :class="{ 'badge--ok': isActive(v) }">
              {{ STATUS_TEXT[v.status] ?? v.status }}
            </span>

            <span class="ver__meta">
              {{ v.createdBy || '未知' }} · {{ formatDateTime(v.createdAt) }}
              <template v-if="v.description"> · {{ v.description }}</template>
            </span>

            <div class="ver__actions">
              <el-button size="small" text :icon="View" @click="onView(v)">查看</el-button>

              <!-- 生效中的那版不用再「启用」了 -->
              <el-button
                v-if="!isActive(v)"
                size="small"
                text
                type="primary"
                :icon="v.status === 'ARCHIVED' ? RefreshLeft : Check"
                :loading="acting === v.id"
                @click="onActivate(v)"
              >
                {{ v.status === 'ARCHIVED' ? '回滚到此版' : '发布' }}
              </el-button>

              <el-button size="small" text :icon="Edit" @click="onEdit(v)">编辑</el-button>

              <!-- ⚠️ 生效中的版本不能删（后端会拒），所以直接禁用并说明原因，
                   别让用户点了看一个红框 -->
              <el-button
                size="small"
                text
                type="danger"
                :icon="Delete"
                :disabled="isActive(v)"
                :title="isActive(v) ? '正在生效的版本不能删，先启用别的版本' : ''"
                @click="onRemove(v)"
              >
                删除
              </el-button>
            </div>
          </div>
        </div>
      </article>

      <el-empty v-if="!loading && !filtered.length" description="没有提示词">
        <el-button type="primary" :icon="Plus" @click="onCreateGroup">新建变体</el-button>
      </el-empty>
    </div>

    <PromptEditDialog
      v-model="dialogVisible"
      :version="editingVersion"
      :group="editingGroup"
      @saved="load"
    />

    <!-- 正文预览 —— 提示词动辄几百行，列表里塞不下 -->
    <el-dialog
      v-model="viewVisible"
      :title="viewing ? `${viewing.scene} / ${viewing.name} · v${viewing.version}` : '查看'"
      width="820px"
      append-to-body
    >
      <p v-if="viewing" class="view__meta">
        {{ STATUS_TEXT[viewing.status] ?? viewing.status }} · {{ viewing.createdBy || '未知' }} ·
        {{ formatDateTime(viewing.createdAt) }}
      </p>
      <pre class="view__content">{{ viewing?.content }}</pre>
    </el-dialog>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-5);
}

.page__head {
  display: flex;
  flex-wrap: wrap;
  gap: var(--mf-space-4);
  align-items: flex-start;
  justify-content: space-between;
}

.page__title {
  margin: 0 0 var(--mf-space-1);
  font-size: var(--mf-font-xl);
  font-weight: var(--mf-weight-medium);
  letter-spacing: -0.02em;
}

.page__sub {
  margin: 0;
  font-size: var(--mf-font-sm);
  color: var(--mf-text-tertiary);
}

.page__actions {
  display: flex;
  gap: var(--mf-space-3);
  align-items: center;
}

.page__filter {
  width: 180px;
}

.list {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-4);
  min-height: 120px;
}

/* ---------- 变体分组 ---------- */
.group {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-3);
  padding: var(--mf-space-5);
  background-color: var(--mf-glass-card);
  border: 1px solid var(--mf-glass-border-soft);
  border-radius: var(--mf-radius-lg);
}

.group__head {
  display: flex;
  flex-wrap: wrap;
  gap: var(--mf-space-3);
  align-items: flex-start;
  justify-content: space-between;
}

.group__main {
  min-width: 0;
}

.group__title {
  display: flex;
  flex-wrap: wrap;
  gap: var(--mf-space-2);
  align-items: center;
}

.group__name {
  font-size: var(--mf-font-md);
  font-weight: var(--mf-weight-medium);
}

.group__scene {
  padding: 0 var(--mf-space-2);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
  background-color: var(--mf-bg-subtle);
  border-radius: var(--mf-radius-pill);
}

.group__meta {
  margin: var(--mf-space-1) 0 0;
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

/* ---------- 版本行 ---------- */
.versions {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-1);
}

.ver {
  display: flex;
  flex-wrap: wrap;
  gap: var(--mf-space-3);
  align-items: center;
  padding: var(--mf-space-2) var(--mf-space-3);
  border-radius: var(--mf-radius-md);
}

/* 生效中的那版给个底 —— 一眼看出线上跑的是哪个 */
.ver--active {
  background-color: var(--mf-success-subtle);
}

.ver__no {
  flex: none;
  width: 32px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: var(--mf-font-sm);
  color: var(--mf-text-secondary);
}

.ver__meta {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ver__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--mf-space-1);
  align-items: center;
}

/* ---------- 徽章 ---------- */
.badge {
  flex: none;
  padding: 0 var(--mf-space-2);
  font-size: var(--mf-font-xs);
  line-height: 20px;
  color: var(--mf-text-secondary);
  white-space: nowrap;
  background-color: var(--mf-bg-subtle);
  border-radius: var(--mf-radius-pill);
}

.badge--ok {
  color: var(--mf-success-text);
  background-color: var(--mf-success-subtle);
}

.badge--primary {
  color: var(--mf-primary-text);
  background-color: var(--mf-primary-subtle);
}

/* ---------- 预览 ---------- */
.view__meta {
  margin: 0 0 var(--mf-space-3);
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

.view__content {
  max-height: 60vh;
  margin: 0;
  padding: var(--mf-space-4);
  overflow: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: var(--mf-font-xs);
  line-height: 1.7;
  color: var(--mf-text-secondary);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  background-color: var(--mf-bg-subtle);
  border-radius: var(--mf-radius-md);
}
</style>
