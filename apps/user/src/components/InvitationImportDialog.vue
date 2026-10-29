<script setup lang="ts">
import { Document, MagicStick, UploadFilled } from '@element-plus/icons-vue'
import { computed, onUnmounted, ref, watch } from 'vue'

import {
  BizError,
  INVITATION_FILE_TYPES,
  JOB_EVENT_MODE_LABELS,
  JOB_EVENT_TYPE_LABELS,
  type ExtractedJobEventVO,
  type InvitationExtractDTO,
  type JobEventMode,
  type JobEventType,
  type JobEventVO,
  type JobVO,
} from '@mindforge/shared'

import { calendarApi } from '@/api/calendar'

const props = defineProps<{
  modelValue: boolean
  /** 职位列表由父组件传 —— 日历页已经加载过，这里不再重复请求 */
  jobs: JobVO[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  /** 导入成功，父组件刷新日历 */
  imported: [count: number]
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

/** 允许上传的类型 —— 与后端解析器 + 前端校验保持一份清单 */
const ACCEPT = '.txt,.md,.pdf,.docx,.png,.jpg,.jpeg'
const MAX_FILE_BYTES = 10 * 1024 * 1024

type Step = 'input' | 'extracting' | 'preview'

const step = ref<Step>('input')
const sourceTab = ref<'text' | 'file'>('text')
const text = ref('')

interface PickedFile {
  name: string
  fileType: string
  base64: string
}

const picked = ref<PickedFile | null>(null)
const pickingFile = ref(false)

/** 抽取中的阶段文案 —— 同步接口没有真进度，用已用秒数驱动，别编百分比 */
const elapsed = ref(0)

/**
 * ⚠️ 阶段文案要跟输入形态对上：粘贴文字时没有「读取文件」这一步，
 *   写着会让人以为系统在找什么文件。
 */
const STAGES = computed(() =>
  sourceTab.value === 'text'
    ? [
        { at: 0, label: '正在分析原文…' },
        { at: 4, label: '正在提取日程…' },
      ]
    : [
        { at: 0, label: '正在读取文件…' },
        { at: 3, label: '正在识别文字…' },
        { at: 7, label: '正在提取日程…' },
      ],
)

const stageLabel = computed(() => {
  let label = STAGES.value[0].label
  for (const s of STAGES.value) if (elapsed.value >= s.at) label = s.label
  return label
})

let timer: number | null = null

function startTimer(): void {
  elapsed.value = 0
  stopTimer()
  timer = window.setInterval(() => (elapsed.value += 1), 1000)
}

function stopTimer(): void {
  if (timer !== null) {
    window.clearInterval(timer)
    timer = null
  }
}

onUnmounted(stopTimer)

const warning = ref<string | null>(null)

/**
 * 预览行。
 *
 * ⚠️ 这一层刻意**不直接改后端返回的对象** —— 用户在表里改的东西要能整体丢弃
 *   （点「重新识别」时清空），改后端对象会污染原始结果。
 */
interface PreviewRow {
  checked: boolean
  title: string
  eventType: JobEventType | null
  /** el-date-picker 的 value-format 就是它 */
  eventAt: string
  eventMode: JobEventMode | ''
  jobId: string
  /** 原文没写时间 / 时间是换算来的 / 原文没写轮次 —— 都只影响提示，不阻断编辑 */
  eventAtDerived: boolean
  eventTypeMissing: boolean
  eventAtMissing: boolean
  /** 与已有日程重复（同一职位 + 同一时间 + 同一标题） */
  duplicated: boolean
  note: string
}

const rows = ref<PreviewRow[]>([])

/** 勾选的行里，还有几条缺职位或时间 —— 缺了就不能提交 */
const blocking = computed(
  () => rows.value.filter((r) => r.checked && (!r.jobId || !r.eventAt)).length,
)

const checkedCount = computed(() => rows.value.filter((r) => r.checked).length)

const canSubmit = computed(() => checkedCount.value > 0 && blocking.value === 0)

/**
 * 底部提示整句拼好再渲染。
 *
 * ⚠️ 别在模板里用 `<template v-if>` 拼半句 —— 标签之间的换行会变成文本节点，
 *   拼出来是「勾选 2 条 。」这种多余空格，换个格式化工具就变样。
 */
const footText = computed(() => {
  if (rows.value.length === 0) return ''
  const head = `勾选 ${checkedCount.value} 条`
  const tail = '导入前请核对时间 —— 提醒会在日程开始前 24 小时内发出。'
  return blocking.value > 0
    ? `${head}，其中 ${blocking.value} 条还缺职位或时间。${tail}`
    : `${head}。${tail}`
})

function reset(): void {
  step.value = 'input'
  sourceTab.value = 'text'
  text.value = ''
  picked.value = null
  rows.value = []
  warning.value = null
  elapsed.value = 0
  stopTimer()
}

watch(visible, (open) => {
  if (!open) reset()
})

function fail(e: unknown, fallback: string): void {
  ElMessage.error(e instanceof BizError ? e.message : fallback)
}

// ---------- 选文件 ----------

/**
 * 只做「读成 base64」，**不在前端解析文件内容**。
 *
 * ★ PDF / DOCX / 图片的解析在后端（那边有 pdfplumber + OCR）。
 *   前端自己解一遍等于把同一件事写两份，而且 PDF 的字体、扫描件、折行这些坑全要重踩。
 * ★ 用原生 input 而不是 el-upload：el-upload 的 change 只在文件列表变化时触发，
 *   「再选同一个文件」不响应，用户会以为按钮坏了。原生 input 每次 change 都会清值重来。
 */
const fileInput = ref<HTMLInputElement>()

function pickFile(): void {
  fileInput.value?.click()
}

async function onFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  // 不清空的话「再选同一个文件」不触发 change
  input.value = ''
  if (!file) return

  const ext = file.name.split('.').pop()?.toUpperCase() ?? ''
  if (!INVITATION_FILE_TYPES.includes(ext as (typeof INVITATION_FILE_TYPES)[number])) {
    ElMessage.error(`只支持 ${INVITATION_FILE_TYPES.join(' / ')}`)
    return
  }
  if (file.size === 0) {
    ElMessage.warning('不能上传空文件（0 字节）')
    return
  }
  if (file.size > MAX_FILE_BYTES) {
    ElMessage.error('文件不能超过 10MB')
    return
  }

  pickingFile.value = true
  try {
    const base64 = await readAsBase64(file)
    picked.value = { name: file.name, fileType: ext === 'JPEG' ? 'JPG' : ext, base64 }
  } catch {
    ElMessage.error('读取文件失败，请重试')
  } finally {
    pickingFile.value = false
  }
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result ?? '')
      // dataURL 形如 data:application/pdf;base64,JVBERi0... —— 只留逗号后面那段
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

// ---------- 抽取 ----------

async function onExtract(): Promise<void> {
  const dto: InvitationExtractDTO =
    sourceTab.value === 'text'
      ? { source: 'TEXT', text: text.value.trim() }
      : { source: 'FILE', fileType: picked.value?.fileType, contentBase64: picked.value?.base64 }

  if (dto.source === 'TEXT' && !dto.text) {
    ElMessage.warning('请先粘贴邀约内容')
    return
  }
  if (dto.source === 'FILE' && !dto.contentBase64) {
    ElMessage.warning('请先选择文件')
    return
  }

  step.value = 'extracting'
  startTimer()
  try {
    const data = await calendarApi.extractInvitation(dto)
    /**
     * ⚠️ 一条都没抽到就别进预览 —— 一张空表是死胡同，用户还得自己点「重新识别」退回来。
     *    停在这一步，把后端的 warning 原样告诉他（它比前端编的文案更具体）。
     */
    if (data.events.length === 0) {
      ElMessage.warning({
        message: data.warning || '没识别出日程，建议手动新建',
        duration: 6000,
      })
      return
    }
    warning.value = data.warning
    rows.value = data.events.map(toRow)
    step.value = 'preview'
    await markDuplicates()
  } catch (e) {
    // 失败退回输入步骤，别把人卡在一个空白的「识别中」
    step.value = 'input'
    fail(e, '识别失败，请重试')
  } finally {
    stopTimer()
  }
}

function toRow(ev: ExtractedJobEventVO): PreviewRow {
  const title = ev.title?.trim() || [ev.companyName, ev.positionName].filter(Boolean).join(' ')
  return {
    // 默认只勾「时间 + 职位都齐」的：缺任何一项都要用户先补，默认勾上会让人误提交
    checked: Boolean(ev.eventAt && ev.matchedJobId),
    title: title || '',
    eventType: ev.eventType,
    eventAt: normalizeEventAt(ev.eventAt),
    eventMode: ev.eventMode ?? '',
    jobId: ev.matchedJobId ?? '',
    eventAtDerived: ev.eventAtDerived,
    eventTypeMissing: ev.eventType === null,
    eventAtMissing: ev.eventAt === null,
    duplicated: false,
    note: buildNote(ev),
  }
}

/**
 * 把后端的时间串补成 `YYYY-MM-DDTHH:mm:ss`。
 *
 * ⚠️ 后端 `eventAt` 是 `LocalDateTime`，**秒为 0 时会序列化成 `2026-11-02T15:00`**
 *   （16 位，没有秒）。而 el-date-picker 绑的是 `value-format="YYYY-MM-DDTHH:mm:ss"`，
 *   给它 16 位的串解析不出来 → 输入框变空 → 这一行被判定「缺时间」而不能提交，
 *   用户会以为「AI 没抽出时间」，其实是格式问题。
 *   日历页的 `openEdit()` 里有同样的补秒处理，这里是同一个坑。
 */
function normalizeEventAt(iso: string | null): string {
  if (!iso) return ''
  if (iso.length === 16) return `${iso}:00`
  return iso.slice(0, 19)
}

/** 把「面试官 / 会议链接 / 备注」合成一条备注 —— 后端 create 只有 note 一个自由字段 */
function buildNote(ev: ExtractedJobEventVO): string {
  const parts: string[] = []
  if (ev.interviewer) parts.push(`面试官：${ev.interviewer}`)
  if (ev.meetingUrl) parts.push(`会议链接：${ev.meetingUrl}`)
  if (ev.location) parts.push(`地点：${ev.location}`)
  if (ev.note) parts.push(ev.note)
  return parts.join('\n')
}

/**
 * 标出与已有日程重复的行。
 *
 * ★ 必须按**导入范围**重新拉一次，不能用日历页当前那屏的数据 ——
 *   导入的日程经常在下个月，用当前月比对等于没比。
 * ★ 比对口径是「职位 + 时间 + 标题」三件套：只比时间会把「同一天两场」误判成重复。
 */
async function markDuplicates(): Promise<void> {
  const dates = rows.value
    .map((r) => r.eventAt.slice(0, 10))
    .filter(Boolean)
    .sort()
  if (dates.length === 0) return

  try {
    const existing: JobEventVO[] = await calendarApi.list({
      from: dates[0],
      to: dates[dates.length - 1],
    })
    // ⚠️ 已有日程的 eventAt 也要过一遍 normalize —— 否则「16 位 vs 19 位」永远对不上，
    //    去重会静默失效（同一份邀约导两次还是出两条）
    const keys = new Set(
      existing.map((e) => `${e.jobId}|${normalizeEventAt(e.eventAt)}|${e.title}`),
    )
    for (const row of rows.value) {
      if (!row.jobId || !row.eventAt) continue
      row.duplicated = keys.has(`${row.jobId}|${row.eventAt}|${row.title}`)
      if (row.duplicated) row.checked = false
    }
  } catch {
    // 查重失败不影响导入，只是不标重复 —— 静默即可，别用报错打断主流程
  }
}

// ---------- 提交 ----------

const submitting = ref(false)

async function onSubmit(): Promise<void> {
  const targets = rows.value.filter((r) => r.checked)
  if (targets.length === 0) return

  submitting.value = true
  let ok = 0
  const failed: string[] = []
  try {
    for (const row of targets) {
      try {
        await calendarApi.create({
          jobId: row.jobId,
          eventType: row.eventType ?? 'OTHER',
          title: row.title.trim() || '面试',
          eventAt: row.eventAt,
          eventMode: row.eventMode || null,
          note: row.note.trim() || null,
        })
        ok++
      } catch (e) {
        // 单条失败不能中断整批 —— 用户已经确认过的其它日程要照常导进去
        failed.push(`${row.title || '未命名'}：${e instanceof BizError ? e.message : '导入失败'}`)
      }
    }
  } finally {
    submitting.value = false
  }

  if (ok > 0) {
    ElMessage.success(`已导入 ${ok} 条日程`)
    emit('imported', ok)
    visible.value = false
  }
  if (failed.length > 0) {
    ElMessage.warning({
      message: `${failed.length} 条没导进去：${failed[0]}${failed.length > 1 ? ' 等' : ''}`,
      duration: 6000,
    })
  }
}

const TYPE_OPTIONS = (Object.keys(JOB_EVENT_TYPE_LABELS) as JobEventType[]).map((v) => ({
  value: v,
  label: JOB_EVENT_TYPE_LABELS[v],
}))

const MODE_OPTIONS = (Object.keys(JOB_EVENT_MODE_LABELS) as JobEventMode[]).map((v) => ({
  value: v,
  label: JOB_EVENT_MODE_LABELS[v],
}))
</script>

<template>
  <!--
    ⚠️ append-to-body 是必须的：日历页外层有 .el-card（overflow: hidden），
    弹窗留在卡片里会被裁掉下半截（见 MEMORY 里那条坑）。
  -->
  <el-dialog
    v-model="visible"
    title="导入面试邀约"
    width="min(1060px, 94vw)"
    top="6vh"
    append-to-body
    :close-on-click-modal="false"
  >
    <!-- ---------- 第一步：给内容 ---------- -->
    <div v-if="step === 'input'">
      <el-tabs v-model="sourceTab">
        <el-tab-pane name="text">
          <template #label>粘贴文字</template>
          <el-input
            v-model="text"
            type="textarea"
            :rows="9"
            maxlength="8000"
            show-word-limit
            placeholder="把 HR 发来的邀约原样粘进来 —— 微信的一段话、邮件正文都行。例：&#10;您好，邀请您参加字节跳动前端开发岗的技术一面，10 月 30 日（周四）下午 2 点，腾讯会议：https://meeting.tencent.com/dm/xxxx"
          />
          <p class="hint">只从原文抽取，原文没写的信息会留空让你补，不会瞎填。</p>
        </el-tab-pane>

        <el-tab-pane name="file">
          <template #label>上传文件 / 截图</template>
          <div class="picker">
            <input
              ref="fileInput"
              type="file"
              class="picker__input"
              :accept="ACCEPT"
              @change="onFileChange"
            />
            <el-button :icon="UploadFilled" :loading="pickingFile" @click="pickFile">
              {{ picked ? '重新选择' : '选择文件' }}
            </el-button>
            <div v-if="picked" class="picker__file">
              <el-icon><Document /></el-icon>
              <span>{{ picked.name }}</span>
            </div>
            <span v-else class="hint picker__tip"
              >支持 PDF / DOCX / TXT / MD / PNG / JPG，不超过 10MB</span
            >
          </div>
          <p class="hint">扫描件 PDF 和截图会走 OCR 识别，可能有错字 —— 识别结果请在下一步核对。</p>
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- ---------- 第二步：识别中 ---------- -->
    <div v-else-if="step === 'extracting'" class="extracting">
      <el-icon class="extracting__icon"><MagicStick /></el-icon>
      <p class="extracting__stage">{{ stageLabel }}</p>
      <el-progress :percentage="100" :indeterminate="true" :show-text="false" :stroke-width="4" />
      <p class="hint">
        已用 {{ elapsed }} 秒，通常 10~20 秒完成。这个窗口要等它跑完，中途关掉会取消本次识别。
      </p>
    </div>

    <!-- ---------- 第三步：核对 ---------- -->
    <div v-else class="preview">
      <el-alert
        v-if="warning"
        :title="warning"
        type="warning"
        :closable="false"
        show-icon
        class="preview__alert"
      />

      <el-table :data="rows" size="small" class="preview__table" max-height="420">
        <el-table-column width="46">
          <template #default="{ row }">
            <el-checkbox v-model="row.checked" />
          </template>
        </el-table-column>

        <el-table-column label="日程" min-width="200">
          <template #default="{ row }">
            <el-input v-model="row.title" size="small" placeholder="标题" />
            <div v-if="row.note" class="preview__note">{{ row.note }}</div>
          </template>
        </el-table-column>

        <el-table-column label="时间" width="196">
          <template #default="{ row }">
            <el-date-picker
              v-model="row.eventAt"
              type="datetime"
              size="small"
              value-format="YYYY-MM-DDTHH:mm:ss"
              placeholder="原文没写，请补"
              style="width: 100%"
            />
            <el-tag v-if="row.eventAtDerived" size="small" type="warning" class="preview__tag">
              由「下周三」这类说法换算
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="类型" width="120">
          <template #default="{ row }">
            <el-select v-model="row.eventType" size="small" placeholder="未识别" clearable>
              <el-option
                v-for="o in TYPE_OPTIONS"
                :key="o.value"
                :value="o.value"
                :label="o.label"
              />
            </el-select>
            <el-tag v-if="row.eventTypeMissing" size="small" class="preview__tag">原文未写</el-tag>
          </template>
        </el-table-column>

        <el-table-column label="形式" width="104">
          <template #default="{ row }">
            <el-select v-model="row.eventMode" size="small" placeholder="未写" clearable>
              <el-option
                v-for="o in MODE_OPTIONS"
                :key="o.value"
                :value="o.value"
                :label="o.label"
              />
            </el-select>
          </template>
        </el-table-column>

        <el-table-column label="关联职位" width="190">
          <template #default="{ row }">
            <el-select
              v-model="row.jobId"
              size="small"
              filterable
              placeholder="请选择职位"
              :class="{ 'preview__job--missing': !row.jobId }"
            >
              <el-option
                v-for="j in jobs"
                :key="j.id"
                :value="j.id"
                :label="j.companyName ? `${j.companyName} · ${j.title}` : j.title"
              />
            </el-select>
            <el-tag v-if="!row.jobId" size="small" type="danger" class="preview__tag">
              没匹配到，必须选
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="状态" width="92">
          <template #default="{ row }">
            <el-tag v-if="row.duplicated" size="small" type="info">已存在</el-tag>
            <span v-else class="preview__ok">待导入</span>
          </template>
        </el-table-column>
      </el-table>

      <p class="hint preview__foot">{{ footText }}</p>
    </div>

    <template #footer>
      <template v-if="step === 'preview'">
        <el-button @click="reset">重新识别</el-button>
        <el-button type="primary" :loading="submitting" :disabled="!canSubmit" @click="onSubmit">
          导入选中 {{ checkedCount }} 条
        </el-button>
      </template>
      <template v-else>
        <el-button @click="visible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="step === 'extracting'"
          :disabled="step === 'extracting'"
          @click="onExtract"
        >
          {{ step === 'extracting' ? '识别中' : '开始识别' }}
        </el-button>
      </template>
    </template>
  </el-dialog>
</template>

<style scoped>
.hint {
  margin: var(--mf-space-3) 0 0;
  font-size: var(--mf-font-xs);
  line-height: 1.6;
  color: var(--mf-text-tertiary);
}

/* ---------- 选文件 ---------- */
.picker {
  display: flex;
  gap: var(--mf-space-3);
  align-items: center;
  min-height: 32px;
}

/* 原生 input 藏起来，靠按钮触发 —— 见 onFileChange 上方的说明 */
.picker__input {
  display: none;
}

.picker__tip {
  margin: 0;
}

.picker__file {
  display: flex;
  gap: var(--mf-space-1);
  align-items: center;
  min-width: 0;
  font-size: var(--mf-font-sm);
  color: var(--mf-text-secondary);
}

.picker__file span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ---------- 识别中 ---------- */
.extracting {
  padding: var(--mf-space-6) var(--mf-space-4);
  text-align: center;
}

.extracting__icon {
  font-size: 28px;
  color: var(--mf-color-primary);
}

.extracting__stage {
  margin: var(--mf-space-3) 0 var(--mf-space-4);
  font-size: var(--mf-font-sm);
}

/* ---------- 预览 ---------- */
.preview__alert {
  margin-bottom: var(--mf-space-3);
}

.preview__table {
  width: 100%;
}

.preview__note {
  margin-top: 2px;
  overflow: hidden;
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview__tag {
  margin-top: 2px;
}

.preview__job--missing :deep(.el-select__wrapper) {
  box-shadow: 0 0 0 1px var(--el-color-danger) inset;
}

.preview__ok {
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

.preview__foot {
  margin-top: var(--mf-space-3);
}
</style>
