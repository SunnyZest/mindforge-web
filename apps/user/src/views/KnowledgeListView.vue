<script setup lang="ts">
import { Plus, Edit, Delete, Collection, ChatDotRound, Right } from '@element-plus/icons-vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { BizError, formatDateTime, type KnowledgeBaseVO } from '@mindforge/shared'

import { knowledgeApi } from '@/api/knowledge'
import KnowledgeBaseDialog from '@/components/KnowledgeBaseDialog.vue'

const router = useRouter()

const loading = ref(false)
const rows = ref<KnowledgeBaseVO[]>([])
const total = ref(0)
const query = reactive({ page: 1, pageSize: 12, keyword: '' })

const dialogVisible = ref(false)
const editing = ref<KnowledgeBaseVO | null>(null)

function fail(e: unknown, fallback: string): void {
  ElMessage.error(e instanceof BizError ? e.message : fallback)
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const data = await knowledgeApi.page({
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword.trim() || undefined,
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

function onCreate(): void {
  editing.value = null
  dialogVisible.value = true
}

function onEdit(row: KnowledgeBaseVO): void {
  editing.value = row
  dialogVisible.value = true
}

function openDetail(row: KnowledgeBaseVO): void {
  void router.push({ name: 'knowledge-detail', params: { id: row.id } })
}

/** 直接拿这个库开一场问答 —— 从「攒资料」到「用资料」的最短路径 */
function startChat(row: KnowledgeBaseVO): void {
  void router.push({ name: 'chat', query: { kb: row.id } })
}

async function onRemove(row: KnowledgeBaseVO): Promise<void> {
  try {
    // ⚠️ 删除会【级联】删掉库下面的文档和对话 —— 必须把后果说清楚，
    //    不能只说「确定删除？」。
    await ElMessageBox.confirm(
      `删除「${row.name}」会连同它下面的 ${row.documentCount ?? 0} 份文档和所有对话一起删掉，且无法恢复。`,
      '删除知识库',
      { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' },
    )
  } catch {
    return // 用户取消
  }

  try {
    await knowledgeApi.remove(row.id)
    ElMessage.success('已删除')
    if (rows.value.length === 1 && query.page > 1) query.page -= 1
    await load()
  } catch (e) {
    fail(e, '删除失败')
  }
}

const empty = computed(() => !loading.value && rows.value.length === 0)

onMounted(load)
</script>

<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">知识库</h1>
        <p class="page__sub">把资料传进来，问答时 AI 会引用原文出处</p>
      </div>

      <div class="page__actions">
        <el-input
          v-model="query.keyword"
          placeholder="搜知识库"
          clearable
          class="page__search"
          @keyup.enter="onSearch"
          @clear="onSearch"
        />
        <el-button type="primary" :icon="Plus" @click="onCreate">新建知识库</el-button>
      </div>
    </header>

    <div v-loading="loading" class="grid">
      <article v-for="kb in rows" :key="kb.id" class="card">
        <div class="card__head">
          <el-icon class="card__icon"><Collection /></el-icon>
          <div class="card__main">
            <button type="button" class="card__name" @click="openDetail(kb)">{{ kb.name }}</button>
            <span class="card__meta">
              {{ kb.documentCount ?? 0 }} 份文档 · 建于 {{ formatDateTime(kb.createdAt) }}
            </span>
          </div>
        </div>

        <p v-if="kb.description" class="card__desc">{{ kb.description }}</p>
        <p v-else class="card__desc card__desc--empty">（没有描述）</p>

        <div class="card__foot">
          <el-button size="small" type="primary" :icon="ChatDotRound" @click="startChat(kb)">
            问答
          </el-button>
          <el-button size="small" :icon="Right" @click="openDetail(kb)">文档</el-button>
          <el-button size="small" :icon="Edit" @click="onEdit(kb)">编辑</el-button>
          <el-button size="small" text type="danger" :icon="Delete" @click="onRemove(kb)">
            删除
          </el-button>
        </div>
      </article>
    </div>

    <el-empty v-if="empty" description="还没有知识库，点右上角新建一个">
      <el-button type="primary" :icon="Plus" @click="onCreate">新建知识库</el-button>
    </el-empty>

    <el-pagination
      v-if="total > query.pageSize"
      v-model:current-page="query.page"
      v-model:page-size="query.pageSize"
      :total="total"
      :page-sizes="[12, 24, 48]"
      layout="total, sizes, prev, pager, next"
      class="page__pager"
      @change="() => load()"
    />

    <KnowledgeBaseDialog v-model="dialogVisible" :kb="editing" @saved="load" />
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-5);
  max-width: 1080px;
  margin: 0 auto;
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

.page__search {
  width: 200px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--mf-space-4);
  min-height: 120px;
}

.card {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-3);
  padding: var(--mf-space-5);
  background-color: var(--mf-glass-card);
  border: 1px solid var(--mf-glass-border-soft);
  border-radius: var(--mf-radius-lg);
}

.card__head {
  display: flex;
  gap: var(--mf-space-3);
  align-items: flex-start;
}

.card__icon {
  display: grid;
  flex: none;
  place-items: center;
  width: 36px;
  height: 36px;
  color: var(--mf-primary-text);
  background-color: var(--mf-primary-subtle);
  border-radius: var(--mf-radius-md);
}

.card__main {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.card__name {
  padding: 0;
  font-size: var(--mf-font-md);
  font-weight: var(--mf-weight-medium);
  color: var(--mf-text-primary);
  text-align: left;
  cursor: pointer;
  background: none;
  border: none;
}

.card__name:hover {
  color: var(--mf-primary-text);
}

.card__name:focus-visible {
  outline: 2px solid var(--mf-primary);
  outline-offset: 2px;
  border-radius: 4px;
}

.card__meta {
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

.card__desc {
  margin: 0;
  font-size: var(--mf-font-sm);
  line-height: 1.6;
  color: var(--mf-text-secondary);
}

.card__desc--empty {
  color: var(--mf-text-tertiary);
}

.card__foot {
  display: flex;
  flex-wrap: wrap;
  gap: var(--mf-space-2);
  margin-top: auto;
}

.page__pager {
  justify-content: flex-end;
}
</style>
