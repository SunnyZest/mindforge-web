<script setup lang="ts">
import { MagicStick, Search } from '@element-plus/icons-vue'
import { computed, onMounted, reactive, ref } from 'vue'

import { BizError, type KnowledgeBaseVO, type SearchHitVO } from '@mindforge/shared'

import { ragApi } from '@/api/chat'
import { knowledgeApi } from '@/api/knowledge'

/**
 * 知识库语义搜索。
 *
 * ★ 与列表页那些「搜职位名/公司名」的关键词搜索不是一回事：
 * 这里走的是**向量语义检索** —— 搜「慢查询怎么排查」能命中写了「索引失效」
 * 的段落，关键词匹配做不到。后端复用 `/app/rag/search`（只检索、不生成回答），
 * 接口本来就有，之前一直没页面用它。
 */

const query = ref('')
const topK = ref(8)
const useRerank = ref(false)
/** 空串 = 全部知识库（后端会并上官方智库） */
const kbId = ref('')

const loading = ref(false)
const searched = ref(false)
const hits = ref<SearchHitVO[]>([])
const reranked = ref(false)
const searchedKbCount = ref(0)
/** 展开完整片段的命中项（默认折叠，避免一屏全是长文） */
const expanded = reactive<Record<string, boolean>>({})

const kbs = ref<KnowledgeBaseVO[]>([])

async function loadKbs(): Promise<void> {
  try {
    const data = await knowledgeApi.page({ page: 1, pageSize: 100 })
    kbs.value = data.records
  } catch {
    // 知识库列表拉不到不影响搜索（不选库就是搜全部），静默
  }
}

async function doSearch(): Promise<void> {
  const q = query.value.trim()
  if (!q) {
    ElMessage.warning('请输入要搜索的内容')
    return
  }

  loading.value = true
  try {
    const data = await ragApi.search({
      query: q,
      topK: topK.value,
      enableRerank: useRerank.value,
      // 不选库就不传 —— 后端按「我的全部知识库 + 官方智库」搜
      knowledgeBaseId: kbId.value || undefined,
    })
    hits.value = data.results
    reranked.value = data.reranked
    searchedKbCount.value = data.searchedKbCount
    searched.value = true
    Object.keys(expanded).forEach((k) => delete expanded[k])
  } catch (e) {
    ElMessage.error(e instanceof BizError ? e.message : '搜索失败')
  } finally {
    loading.value = false
  }
}

function onClear(): void {
  query.value = ''
  hits.value = []
  searched.value = false
}

/**
 * 把命中的关键词高亮出来。
 *
 * ⚠️ <b>先转义再插标签</b>，顺序不能反：文档正文是用户上传的内容，
 * 直接 v-html 拼接等于开了 XSS 的口子。
 *
 * ⚠️ <b>必须按「词」高亮，不能拿整句去匹配</b>：这是<b>语义</b>检索 ——
 * 搜「Java 为什么能跨平台」命中的正文里根本没有这句话（命中靠的是向量相似度），
 * 拿整句做正则结果就是一条都不亮。所以按空白/标点拆成词，逐个高亮。
 */
function highlighted(content: string | null): string {
  if (!content) return ''
  const escaped = escapeHtml(content)

  const terms = tokenize(query.value)
  if (terms.length === 0) return escaped

  // 长的排前面：先匹配长词，避免短词把长词切碎（"Java" 先匹配会把 "JavaScript" 切开）
  const pattern = [...terms]
    .sort((a, b) => b.length - a.length)
    .map((t) => escapeHtml(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')

  return escaped.replace(new RegExp(pattern, 'gi'), (m) => `<mark class="hit__mark">${m}</mark>`)
}

/** 查询 → 高亮用的词。丢掉单字（「的」「了」会满屏高亮，反而看不清命中在哪） */
function tokenize(text: string): string[] {
  return text
    .trim()
    .split(/[\s,，。、；;：:！!？?（）()[\]【】"'“”]+/)
    .filter((t) => t.length >= 2)
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 相关度百分比 —— 0~1 的分数直接转成整数百分比更好读 */
function scorePercent(score: number | null): number {
  if (score == null) return 0
  return Math.round(Math.max(0, Math.min(1, score)) * 100)
}

function sourceLabel(hit: SearchHitVO): string {
  const parts: string[] = []
  if (hit.documentName) parts.push(hit.documentName)
  if (hit.chunkIndex != null) parts.push(`第 ${hit.chunkIndex + 1} 段`)
  return parts.join(' · ')
}

const hasResults = computed(() => hits.value.length > 0)

onMounted(loadKbs)
</script>

<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h2 class="page__title">知识库搜索</h2>
        <p class="page__sub">
          按语义检索你上传的资料 —— 搜「怎么排查慢查询」也能命中写了「索引失效」的段落，
          这是关键词匹配做不到的
        </p>
      </div>
    </header>

    <!-- ---------- 搜索条件 ---------- -->
    <section class="search mf-glass">
      <div class="search__row">
        <el-input
          v-model="query"
          size="large"
          placeholder="想查什么？比如「MySQL 索引失效的场景」"
          clearable
          class="search__input"
          @keyup.enter="doSearch"
          @clear="onClear"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-button type="primary" size="large" :loading="loading" @click="doSearch">
          搜索
        </el-button>
      </div>

      <div class="search__row search__row--options">
        <el-select v-model="kbId" placeholder="全部知识库" clearable class="search__kb">
          <el-option label="全部知识库（含官方智库）" value="" />
          <el-option
            v-for="kb in kbs"
            :key="kb.id"
            :label="kb.name"
            :value="kb.id"
          />
        </el-select>

        <el-select v-model="topK" class="search__topk">
          <el-option v-for="n in [5, 8, 15, 30]" :key="n" :label="`返回 ${n} 条`" :value="n" />
        </el-select>

        <el-tooltip
          content="用重排序模型对结果重新精排，更准但更慢；管理端没配 RERANK 模型时会自动退回向量序"
          placement="top"
        >
          <el-checkbox v-model="useRerank" label="结果精排" />
        </el-tooltip>
      </div>
    </section>

    <!-- ---------- 结果 ---------- -->
    <section v-loading="loading" class="result">
      <template v-if="searched">
        <div class="result__meta">
          <span>
            命中 <b>{{ hits.length }}</b> 条
            <template v-if="searchedKbCount > 0">· 已在 {{ searchedKbCount }} 个知识库中检索</template>
          </span>
          <el-tag v-if="reranked" size="small" type="success" effect="plain">
            <el-icon><MagicStick /></el-icon>
            已精排
          </el-tag>
        </div>

        <el-empty v-if="!hasResults" description="没有找到相关内容，换个说法试试" />

        <ul v-else class="hits">
          <li v-for="hit in hits" :key="hit.chunkId" class="hit mf-glass-card-interactive">
            <div class="hit__head">
              <div class="hit__source">
                <span class="hit__doc">{{ hit.documentName }}</span>
                <el-tag v-if="hit.fromSystemKb" size="small" type="warning" effect="plain">
                  官方智库
                </el-tag>
                <el-tag v-else-if="hit.knowledgeBaseName" size="small" effect="plain">
                  {{ hit.knowledgeBaseName }}
                </el-tag>
                <span class="hit__chunk">第 {{ (hit.chunkIndex ?? 0) + 1 }} 段</span>
              </div>

              <!-- 相关度：横向小条 + 百分比，比纯数字直观 -->
              <div class="hit__score" :title="`相关度 ${hit.score ?? 0}`">
                <div class="hit__score-bar">
                  <div class="hit__score-fill" :style="{ width: scorePercent(hit.score) + '%' }" />
                </div>
                <span class="hit__score-num">{{ scorePercent(hit.score) }}</span>
              </div>
            </div>

            <div
              class="hit__content"
              :class="{ 'hit__content--expanded': expanded[hit.chunkId] }"
              v-html="highlighted(hit.content)"
            />

            <div class="hit__foot">
              <el-button
                text
                size="small"
                @click="expanded[hit.chunkId] = !expanded[hit.chunkId]"
              >
                {{ expanded[hit.chunkId] ? '收起' : '展开全文' }}
              </el-button>
              <span class="hit__tip">来自《{{ sourceLabel(hit) }}》</span>
            </div>
          </li>
        </ul>
      </template>

      <el-empty v-else description="输入关键词开始语义搜索" :image-size="110" />
    </section>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.page__title {
  margin: 0 0 4px;
  font-size: var(--mf-font-lg);
  font-weight: 700;
  color: var(--mf-text-primary);
}

.page__sub {
  margin: 0;
  font-size: var(--mf-font-sm);
  color: var(--mf-text-secondary);
}

/* ---------- 搜索条件 ---------- */
.search {
  padding: 16px;
}

.search__row {
  display: flex;
  gap: 10px;
}

.search__row--options {
  flex-wrap: wrap;
  align-items: center;
  margin-top: 12px;
}

.search__input {
  flex: 1;
}

.search__kb {
  width: 240px;
}

.search__topk {
  width: 130px;
}

/* ---------- 结果 ---------- */
.result__meta {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 12px;
  font-size: var(--mf-font-sm);
  color: var(--mf-text-secondary);
}

.hits {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0;
  margin: 0;
  list-style: none;
}

.hit {
  padding: 14px 16px;
}

.hit__head {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.hit__source {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  min-width: 0;
}

.hit__doc {
  overflow: hidden;
  font-size: var(--mf-font-sm);
  font-weight: 600;
  color: var(--mf-text-primary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hit__chunk {
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

.hit__score {
  display: flex;
  flex: none;
  gap: 6px;
  align-items: center;
}

.hit__score-bar {
  width: 56px;
  height: 4px;
  overflow: hidden;
  background-color: var(--mf-bg-hover);
  border-radius: var(--mf-radius-pill);
}

.hit__score-fill {
  height: 100%;
  background-color: var(--mf-primary);
  border-radius: var(--mf-radius-pill);
}

.hit__score-num {
  font-family: var(--mf-font-mono, monospace);
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

.hit__content {
  display: -webkit-box;
  overflow: hidden;
  font-size: var(--mf-font-sm);
  line-height: 1.7;
  color: var(--mf-text-secondary);
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.hit__content--expanded {
  display: block;
  overflow: visible;
}

.hit__content :deep(.hit__mark) {
  padding: 0 2px;
  color: var(--mf-text-primary);
  background-color: color-mix(in srgb, var(--mf-warning) 40%, transparent);
  border-radius: 3px;
}

.hit__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}

.hit__tip {
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}
</style>
