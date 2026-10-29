<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import type { AiEffectiveConfigVO, AiEffectiveSceneVO, AiModelVO, AiScene } from '@mindforge/shared'
import { BizError } from '@mindforge/shared'

import { aiModelApi } from '@/api/ai'
import AiModelFormDialog from '@/components/AiModelFormDialog.vue'
import StatusTag from '@/components/StatusTag.vue'
import { useAuthStore } from '@/stores/auth'
import { formatDateTime } from '@/utils/format'

const auth = useAuthStore()

const loading = ref(false)
/** 快照请求单独的 loading —— 两个请求可能一个成一个败，混用会让表格整片变遮罩 */
const effLoading = ref(false)
const rows = ref<AiModelVO[]>([])

/**
 * 用途分组。固定顺序 —— 对话在最上面，因为它是管理员最常来看的那组。
 *
 * ⚠️ 这里是**写死**的三个用途，不是从后端拿的：
 * `AiScene` 是联合类型，新增用途必须同步改
 * `packages/shared/src/types.ts` 和后端 `ai_config.ALL_SCENES`，
 * 只靠响应里的 `scenes` 渲染会漏掉「后端加了、前端不认识」的用途，
 * 那种情况应该表现为**类型检查报错**，而不是页面上悄悄少一行。
 */
const SCENES: AiScene[] = ['CHAT', 'EMBEDDING', 'RERANK']

const SCENE_TEXT: Record<AiScene, string> = { CHAT: '对话', EMBEDDING: '向量化', RERANK: '重排' }

/** 分组标题上的一句话说明 —— 让「重排」「向量化」这些词对新管理员有意义 */
const SCENE_HINT: Record<AiScene, string> = {
  CHAT: '所有对话类功能：简历优化、面试报告、知识库问答',
  EMBEDDING: '知识库向量化，检索时的语义召回',
  RERANK: '检索结果重排。没有环境变量兜底，不配就跳过重排',
}

/**
 * 生效快照。`null` = 还没拿到（加载中或失败）。
 *
 * ⚠️ 和列表**分开加载**：快照依赖 Python 服务，列表依赖 Java 和 MySQL。
 * 合成一个请求的话，Python 挂了整个页面就什么都看不到 —— 但那时候
 * 管理员恰恰最需要看到「配了哪些」（去判断是不是配置本身的问题）。
 */
const effective = ref<AiEffectiveConfigVO | null>(null)
const effectiveError = ref<string | null>(null)

const formVisible = ref(false)
/** null = 新增 */
const formModel = ref<AiModelVO | null>(null)

function fail(e: unknown, fallback: string): void {
  ElMessage.error(e instanceof BizError ? e.message : fallback)
}

/** el-table 插槽的 row 是 `DefaultRow`，转成我们的类型 */
function asModel(row: unknown): AiModelVO {
  return row as AiModelVO
}

/**
 * 模型配置列表。
 *
 * ⚠️ 返回的是**数组不是分页**（同角色列表）—— 配置就几条，别加分页控件。
 */
async function load(): Promise<void> {
  loading.value = true
  try {
    rows.value = await aiModelApi.list()
  } catch (e) {
    fail(e, '加载失败')
  } finally {
    loading.value = false
  }
}

/**
 * 生效快照。⚠️ 失败时**不弹 toast**，只把话留在页头的提示条里：
 * 进来就挨一下红报错太吵，而且这个信息在页面上有固定的位置可看。
 */
async function loadEffective(): Promise<void> {
  effectiveError.value = null
  effLoading.value = true
  try {
    effective.value = await aiModelApi.effective()
  } catch (e) {
    effective.value = null
    effectiveError.value = e instanceof BizError ? e.message : '读不到当前生效的配置'
  } finally {
    effLoading.value = false
  }
}

/** 两个请求都在跑的时候，「刷新」按钮才算忙 —— 它触发的是两件事 */
const busy = computed(() => loading.value || effLoading.value)

function reload(): void {
  void load()
  void loadEffective()
}

/** 每个用途的生效项；没拿到快照时是 undefined */
function effectiveOf(scene: AiScene): AiEffectiveSceneVO | undefined {
  return effective.value?.scenes.find((s) => s.scene === scene)
}

/**
 * 「当前生效」那一行的状态色：
 * - ok        有模型、有 Key
 * - nokey     模型有但没有 Key —— 调用必然在 _ensure_configured 那步被拦下
 * - empty     模型名为空（确实未配置）
 * - unknown   没拿到快照（AI 服务不可达）
 *
 * ★ empty 和 unknown 必须分开：前者该去「配一个模型」，后者该去「把 AI 服务起起来」。
 *   都显示成「未配置」的话，管理员会去配一个本来就有的模型 —— 这正是这个接口
 *   在后端刻意「查不到就抛 50201」而不是回空列表的原因，前端不能又把它合回去。
 */
type EffTone = 'ok' | 'nokey' | 'empty' | 'unknown'

function effToneOf(eff: AiEffectiveSceneVO | undefined): EffTone {
  if (!eff) return 'unknown'
  if (!eff.model.trim()) return 'empty'
  return eff.hasKey ? 'ok' : 'nokey'
}

/** 当前生效的模型名；空串时给一句人话 */
function effModelText(eff: AiEffectiveSceneVO | undefined): string {
  // ⚠️ 这里只回短横，不回「读不到」—— 右边那个标签已经说了，
  //    两处都写「读不到」会变成「当前生效 读不到 读不到」。
  if (!eff) return '—'
  if (!eff.model.trim()) return '未配置'
  return eff.model
}

/** 来源：管理端配置 / .env 兜底 */
function effSourceText(eff: AiEffectiveSceneVO | undefined): string {
  if (!eff) return ''
  return eff.source === 'env' ? '.env 默认值' : '管理端配置'
}

interface SceneGroup {
  scene: AiScene
  list: AiModelVO[]
  effective: AiEffectiveSceneVO | undefined
}

const groups = computed<SceneGroup[]>(() =>
  SCENES.map((scene) => ({
    scene,
    list: rows.value.filter((r) => r.scene === scene),
    effective: effectiveOf(scene),
  })),
)

/**
 * 某个用途需要提醒的情况。
 *
 * ★ 这三种「看不出来」正是加 `/effective` 的原因：
 *   ① 多条配置但都没勾默认 → 实际生效的是 id 最大那条，不是你想的那条；
 *   ② 一条都没配 → 走 .env，库里根本没有这条记录；
 *   ③ 生效模型没有 Key → 功能会失败，但列表看上去一切正常。
 */
function warningOf(g: SceneGroup): string | null {
  const eff = g.effective
  // 快照没拿到时不猜 —— 已经在页头说明「读不到」了，这里再猜一遍只会误导
  if (!eff) return null

  if (effToneOf(eff) === 'nokey') {
    return `当前生效的「${eff.model}」没有可用的 API Key，调用会在鉴权前就被拦下。`
  }

  if (g.list.length === 0) {
    return effToneOf(eff) === 'empty'
      ? '这个用途一条都没配，也读不到 .env 默认值 —— 相关功能直接不可用。'
      : `这个用途一条都没配，正在用 .env 的「${eff.model}」。想固定下来就在这里新增一条。`
  }

  const hasDefault = g.list.some((r) => r.isDefault && r.status === 1)
  if (!hasDefault) {
    return `这个用途有 ${g.list.length} 条配置但都没勾「默认」，实际生效的是 id 最大的那条。建议勾一个默认，免得改配置时踩空。`
  }

  return null
}

/**
 * 生效的那条**不是**被勾成默认的那条。
 *
 * 说明默认标记指向了一条禁用记录，或者默认那条没同步到 Python。
 * 这种情况必须点名 —— 否则管理员会一直以为自己在改一条生效的配置。
 */
function defaultMismatch(g: SceneGroup): string | null {
  const eff = g.effective
  if (!eff || !eff.model.trim() || eff.source !== 'java') return null

  const defaultRow = g.list.find((r) => r.isDefault && r.status === 1)
  if (!defaultRow || defaultRow.modelName === eff.model) return null

  return `勾了默认的「${defaultRow.modelName}」和实际生效的「${eff.model}」不一致 —— 快照最多滞后 60 秒，稍后刷新再看；一直不一致说明默认那条没同步过去。`
}

/**
 * 表格里这条配置是不是「当前生效」的那条。
 *
 * ⚠️ 三个条件缺一不可，只看模型名会误标：
 *   ① 来源必须是 `java` —— 走 .env 时列表里**没有**对应的生效记录，
 *      这时如果恰好有一条同名配置（哪怕被禁用了）会被当成生效项，指向错的反而更糟；
 *   ② 模型名相同 —— 后端只回模型名，同名多条无法进一步区分，只能都标（它本来就等价）；
 *   ③ 必须是启用的 —— 禁用的记录不参与解析。
 */
function isEffectiveRow(g: SceneGroup, row: AiModelVO): boolean {
  const eff = g.effective
  if (!eff || eff.source !== 'java' || !eff.model.trim()) return false
  return row.modelName === eff.model && row.status === 1
}

/** 新增时预填的用途 —— 从分组头上点「新增」进来的人已经选定用途了 */
const formScene = ref<AiScene>('CHAT')

function onCreate(scene?: AiScene): void {
  // ⚠️ 新增时 model 必须是 null —— 表单里 `model !== null` 就是「编辑」，
  //    塞一个只带 scene 的假对象会被当成编辑（id 还是 undefined）。
  formModel.value = null
  formScene.value = scene ?? 'CHAT'
  formVisible.value = true
}

function onEdit(row: AiModelVO): void {
  formModel.value = row
  formVisible.value = true
}

async function onDelete(row: AiModelVO): Promise<void> {
  const ok = await ElMessageBox.confirm(
    `删除模型配置「${row.name}」后，走它调用的功能（对话 / 检索 / 重排）会失败，` +
      '除非该用途下还有别的启用配置。确定删除吗？',
    '删除确认',
    { type: 'warning', confirmButtonText: '删除' },
  ).catch(() => false)
  if (!ok) return

  try {
    await aiModelApi.remove(row.id)
    ElMessage.success('已删除')
    reload()
  } catch (e) {
    fail(e, '删除失败')
  }
}

onMounted(reload)
</script>

<template>
  <div class="ai">
    <!-- 页头：快照的时间与同步错误。失败时不弹 toast，话放这里 -->
    <el-alert
      v-if="effectiveError"
      type="error"
      :closable="false"
      show-icon
      class="ai__alert"
      title="读不到当前生效的配置"
    >
      {{ effectiveError }}
    </el-alert>
    <el-alert
      v-else-if="effective?.lastError"
      type="warning"
      :closable="false"
      show-icon
      class="ai__alert"
      title="上次同步配置到 AI 服务失败"
    >
      {{ effective.lastError }} —— AI 服务可能还在用旧配置，改完不生效先看这里。
    </el-alert>

    <div class="ai__bar">
      <!-- ★ 这里不再放全局「新增配置」按钮：分组后每组右上角都有「新增xx配置」，
           语义更准（不用在弹窗里再选一次用途，选错用途的后果是「加了配置却没效果」）。
           两个入口并排放着只会让人犹豫点哪个。 -->
      <span class="ai__hint">
        下面配的是后端调模型用的地址和 Key，保存后最多 60 秒生效，不用重启服务。
      </span>
      <span v-if="effective" class="ai__sync">
        快照时间 {{ formatDateTime(effective.refreshedAt) }}
      </span>
      <el-button link :loading="busy" @click="reload">刷新</el-button>
    </div>

    <!-- 每个用途一组：组头写「当前生效」，组内是该用途的全部配置 -->
    <el-card v-for="g in groups" :key="g.scene" shadow="never" class="ai__group">
      <div class="ai__grouphead">
        <div class="ai__grouptitle">
          <span class="ai__scenename">{{ SCENE_TEXT[g.scene] }}</span>
          <code class="ai__scenecode">{{ g.scene }}</code>
          <span class="ai__scenehint">{{ SCENE_HINT[g.scene] }}</span>
        </div>
        <!-- ★ 每组的唯一新增入口，所以用常规按钮而不是 link：
             全局那个按钮删掉之后，这里是主操作，link 的分量撑不住 -->
        <el-button v-if="auth.can('admin:ai:manage')" size="small" @click="onCreate(g.scene)">
          新增{{ SCENE_TEXT[g.scene] }}配置
        </el-button>
      </div>

      <!-- 当前生效：这一行是整页的重点，列表答不出的就是它 -->
      <div class="eff" :class="`eff--${effToneOf(g.effective)}`">
        <span class="eff__label">当前生效</span>
        <!-- 只有真有模型名时才用等宽字重 —— 「未配置」「读不到」是状态词，不是模型名 -->
        <code
          v-if="effToneOf(g.effective) === 'ok' || effToneOf(g.effective) === 'nokey'"
          class="eff__model"
        >
          {{ effModelText(g.effective) }}
        </code>
        <span v-else class="eff__model eff__model--empty">{{ effModelText(g.effective) }}</span>

        <StatusTag v-if="effToneOf(g.effective) === 'ok'" tone="success">Key 已配置</StatusTag>
        <StatusTag v-else-if="effToneOf(g.effective) === 'nokey'" tone="warning">
          Key 缺失
        </StatusTag>
        <StatusTag v-else-if="effToneOf(g.effective) === 'unknown'" tone="neutral">
          读不到
        </StatusTag>
        <StatusTag v-else tone="neutral">未配置</StatusTag>

        <!-- ★ 模型名为空时不显示来源：连模型都没有，说「来源 .env」只会自相矛盾 -->
        <span v-if="g.effective && g.effective.model.trim()" class="eff__source">
          来源：{{ effSourceText(g.effective) }}
        </span>
      </div>

      <el-alert
        v-for="(msg, i) in [warningOf(g), defaultMismatch(g)].filter((m): m is string => !!m)"
        :key="i"
        type="warning"
        :closable="false"
        show-icon
        class="ai__alert ai__alert--inline"
      >
        {{ msg }}
      </el-alert>

      <!-- 列宽合计 750px（去掉了「用途」列，已按用途分组），1366 下内容区约 1040px -->
      <el-table v-loading="loading" :data="g.list" border stripe class="ai__table">
        <el-table-column prop="name" label="名称" min-width="120" show-overflow-tooltip />
        <el-table-column prop="provider" label="提供方" width="100">
          <template #default="{ row }">
            <code class="code">{{ asModel(row).provider }}</code>
          </template>
        </el-table-column>
        <el-table-column prop="modelName" label="模型名" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="modelname">
              {{ asModel(row).modelName }}
              <!-- 和「当前生效」同一条时直接标出来，省得两处对着看 -->
              <StatusTag v-if="isEffectiveRow(g, asModel(row))" tone="success">生效中</StatusTag>
            </span>
          </template>
        </el-table-column>
        <el-table-column label="默认" width="70" align="center">
          <template #default="{ row }">
            <StatusTag v-if="asModel(row).isDefault" tone="info">默认</StatusTag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="API Key" width="110">
          <template #default="{ row }">
            <!-- 后端永远不给明文，只有尾号提示。没配就明说，别显示成空 -->
            <span v-if="asModel(row).hasApiKey" class="keyhint">
              {{ asModel(row).apiKeyHint || '已配置' }}
            </span>
            <span v-else class="keyhint keyhint--none">未配置</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80" align="center">
          <template #default="{ row }">
            <StatusTag :tone="asModel(row).status === 1 ? 'success' : 'danger'">
              {{ asModel(row).status === 1 ? '启用' : '禁用' }}
            </StatusTag>
          </template>
        </el-table-column>
        <el-table-column label="更新时间" width="145">
          <template #default="{ row }">{{ formatDateTime(asModel(row).updatedAt) }}</template>
        </el-table-column>

        <el-table-column label="操作" width="110" fixed="right">
          <template #default="{ row }">
            <span class="actions">
              <el-button link type="primary" @click="onEdit(asModel(row))">编辑</el-button>
              <el-button link type="danger" @click="onDelete(asModel(row))">删除</el-button>
            </span>
          </template>
        </el-table-column>

        <template #empty>这个用途还没配过模型</template>
      </el-table>
    </el-card>

    <AiModelFormDialog
      v-model="formVisible"
      :model="formModel"
      :default-scene="formScene"
      @saved="reload"
    />
  </div>
</template>

<style scoped>
.ai__bar {
  display: flex;
  gap: var(--mf-space-4);
  align-items: center;
  padding: var(--mf-space-4) var(--mf-space-5);
  margin-bottom: var(--mf-space-4);
  background-color: var(--mf-bg-surface);
  border: 1px solid var(--mf-border-subtle);
  border-radius: var(--mf-radius-lg);
}

.ai__hint {
  flex: 1;
  font-size: var(--mf-font-sm);
  color: var(--mf-text-tertiary);
}

.ai__sync {
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
  white-space: nowrap;
}

.ai__alert {
  margin-bottom: var(--mf-space-4);
}

/* 组内的提示条贴着上面那行，别和组间距混在一起 */
.ai__alert--inline {
  margin-top: var(--mf-space-3);
  margin-bottom: 0;
}

.ai__group {
  margin-bottom: var(--mf-space-5);
}

.ai__grouphead {
  display: flex;
  gap: var(--mf-space-3);
  align-items: baseline;
  margin-bottom: var(--mf-space-3);
}

.ai__grouptitle {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: var(--mf-space-2);
  align-items: baseline;
  min-width: 0;
}

.ai__scenename {
  font-size: var(--mf-font-md);
  font-weight: 600;
  color: var(--mf-text-primary);
}

.ai__scenecode {
  padding: 0 var(--mf-space-2);
  font-family: var(--mf-font-mono, ui-monospace, monospace);
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
  background-color: var(--mf-bg-subtle);
  border-radius: var(--mf-radius-sm);
}

.ai__scenehint {
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

/* 当前生效条 —— 用 success/warning 的弱底，比普通卡片醒目一档 */
.eff {
  display: flex;
  flex-wrap: wrap;
  gap: var(--mf-space-3);
  align-items: center;
  padding: var(--mf-space-3) var(--mf-space-4);
  margin-bottom: var(--mf-space-3);
  border-radius: var(--mf-radius-md);
}

.eff--ok {
  background-color: var(--mf-success-subtle);
}

.eff--nokey {
  background-color: var(--mf-warning-subtle);
}

.eff--empty {
  background-color: var(--mf-bg-subtle);
}

/* 读不到快照 —— 和「确实没配」用同一个灰底，靠文案和标签区分就够了，
   再加一种颜色会让「哪个更严重」变成新的理解成本 */
.eff--unknown {
  background-color: var(--mf-bg-subtle);
}

.eff__label {
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

.eff__model {
  font-family: var(--mf-font-mono, ui-monospace, monospace);
  font-size: var(--mf-font-md);
  font-weight: 600;
  color: var(--mf-text-primary);
}

.eff__model--empty {
  font-family: inherit;
  font-weight: 400;
  color: var(--mf-text-tertiary);
}

.eff__source {
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

.ai__table {
  width: 100%;
}

.code {
  font-family: var(--mf-font-mono, ui-monospace, monospace);
  font-size: var(--mf-font-xs);
  color: var(--mf-text-secondary);
}

.modelname {
  display: inline-flex;
  gap: var(--mf-space-3);
  align-items: center;
}

.keyhint {
  font-family: var(--mf-font-mono, ui-monospace, monospace);
  font-size: var(--mf-font-xs);
  color: var(--mf-text-secondary);
}

.keyhint--none {
  font-family: inherit;
  color: var(--mf-text-tertiary);
}

.actions {
  display: inline-flex;
  gap: var(--mf-space-2);
  white-space: nowrap;
}
</style>
