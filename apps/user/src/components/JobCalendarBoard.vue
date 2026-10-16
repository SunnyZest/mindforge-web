<script setup lang="ts">
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  Clock,
  Delete,
  Edit,
  Location,
  Plus,
  VideoCamera,
} from '@element-plus/icons-vue'
import { computed, onMounted, reactive, ref, watch } from 'vue'

import {
  BizError,
  JOB_EVENT_MODE_LABELS,
  JOB_EVENT_TYPE_LABELS,
  type JobEventMode,
  type JobEventSaveDTO,
  type JobEventStatus,
  type JobEventType,
  type JobEventVO,
  type JobVO,
} from '@mindforge/shared'

import { calendarApi } from '@/api/calendar'
import { jobApi } from '@/api/job'

const props = defineProps<{
  /** 跟随职位页的搜索框 —— 只在本地过滤，不重新请求 */
  keyword?: string
}>()

/**
 * 日程类型 → 颜色。
 *
 * ★ 为什么要按类型上色而不是按公司：一屏里同一天可能挤着三家公司的日程，
 * 按公司着色会出现「六种互不相干的颜色」，反而看不出「今天有两场面试」。
 * 按类型着色，扫一眼就能分清笔试 / 技术面 / HR 面的节奏。
 */
const TYPE_TONE: Record<JobEventType, string> = {
  WRITTEN_TEST: '#0a84ff',
  INTERVIEW_1: '#5856d6',
  INTERVIEW_2: '#af52de',
  HR: '#ff9500',
  OFFER_TALK: '#34c759',
  OTHER: '#8e8e93',
}

const STATUS_LABELS: Record<JobEventStatus, string> = {
  PENDING: '待进行',
  DONE: '已完成',
  CANCELLED: '已取消',
}

/**
 * 选项数组。
 *
 * ⚠️ 不直接在模板里 `v-for` 遍历 Record —— 那样 key 的类型是 string，
 * 和 v-model 的 JobEventType 对不上，类型检查会报错。
 */
const TYPE_OPTIONS = (Object.keys(JOB_EVENT_TYPE_LABELS) as JobEventType[]).map((value) => ({
  value,
  label: JOB_EVENT_TYPE_LABELS[value],
}))

const MODE_OPTIONS = (Object.keys(JOB_EVENT_MODE_LABELS) as JobEventMode[]).map((value) => ({
  value,
  label: JOB_EVENT_MODE_LABELS[value],
}))

const STATUS_OPTIONS = (Object.keys(STATUS_LABELS) as JobEventStatus[]).map((value) => ({
  value,
  label: STATUS_LABELS[value],
}))

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

const todayKey = toDateKey(new Date())

/** 当前显示的月份（取该月 1 号，避免 31 号切月时溢出） */
const cursor = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
const selectedDate = ref(todayKey)

const events = ref<JobEventVO[]>([])
const jobs = ref<JobVO[]>([])
const loading = ref(false)

const dialogVisible = ref(false)
const editing = ref<JobEventVO | null>(null)
const submitting = ref(false)

/** 还没有任何职位 —— 日程必须挂职位，得先提示用户去建 */
const noJobs = computed(() => jobs.value.length === 0)

const form = reactive({
  jobId: '',
  eventType: 'INTERVIEW_1' as JobEventType,
  title: '',
  eventAt: '',
  durationMinutes: 60 as number | null,
  /** 空串 = 未定（后端把空串规整成 null） */
  eventMode: 'ONLINE' as JobEventMode | '',
  location: '',
  note: '',
  status: 'PENDING' as JobEventStatus,
})

/** 自动填充的标题 —— 用户一旦手改过就不再覆盖 */
const autoTitle = ref('')

function toDateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function fail(e: unknown, fallback: string): void {
  ElMessage.error(e instanceof BizError ? e.message : fallback)
}

// ------------------------------------------------------------ 月份网格

/**
 * 固定 6 行 × 7 列 = 42 格，从当月 1 号所在周的**周一**开始。
 *
 * ★ 为什么固定 6 行：不固定的话月份之间行数会变（4~6 行），
 * 切月时整个页面高度跳动，下面的内容跟着闪。
 */
const gridDays = computed(() => {
  const y = cursor.value.getFullYear()
  const m = cursor.value.getMonth()
  const first = new Date(y, m, 1)
  const offset = (first.getDay() + 6) % 7 // 周一 = 0
  const start = new Date(y, m, 1 - offset)

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    const key = toDateKey(d)
    return {
      key,
      day: d.getDate(),
      inMonth: d.getMonth() === m,
      isToday: key === todayKey,
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
    }
  })
})

const monthLabel = computed(
  () => `${cursor.value.getFullYear()} 年 ${cursor.value.getMonth() + 1} 月`,
)

// ------------------------------------------------------------ 数据

async function load(): Promise<void> {
  loading.value = true
  try {
    const days = gridDays.value
    // 一次把整屏（含前后补位那几天）拉回来，翻月不用再请求零散区间
    events.value = await calendarApi.list({
      from: days[0].key,
      to: days[days.length - 1].key,
    })
  } catch (e) {
    fail(e, '加载日程失败')
  } finally {
    loading.value = false
  }
}

async function loadJobs(): Promise<void> {
  try {
    // 后端单页上限 100，够用；日程必须挂职位，所以要给选择器备好列表
    const data = await jobApi.page({ page: 1, pageSize: 100 })
    jobs.value = data.records
  } catch {
    // 职位拉不到不影响看已有日程，静默即可
  }
}

/**
 * ⚠️ 翻月必须重新拉数据。
 *
 * 网格是「整屏 42 格」，翻月后这 42 天的区间整体挪了一周 ——
 * 不重拉的话，新露出来的那几天是空的，而已经不在这屏里的旧日程还会赖着不走。
 */
watch(cursor, () => {
  void load()
})

const filteredEvents = computed(() => {
  const kw = (props.keyword ?? '').trim().toLowerCase()
  if (!kw) return events.value
  return events.value.filter(
    (e) =>
      e.title.toLowerCase().includes(kw) ||
      (e.companyName ?? '').toLowerCase().includes(kw) ||
      (e.jobTitle ?? '').toLowerCase().includes(kw),
  )
})

const eventsByDay = computed(() => {
  const map = new Map<string, JobEventVO[]>()
  for (const ev of filteredEvents.value) {
    const key = ev.eventAt.slice(0, 10)
    const list = map.get(key)
    if (list) {
      list.push(ev)
    } else {
      map.set(key, [ev])
    }
  }
  return map
})

const selectedEvents = computed(() => eventsByDay.value.get(selectedDate.value) ?? [])

/** 选中日是否属于当前显示的月份 —— 用来给侧栏标题加「(上/下月)」提示 */
const selectedInMonth = computed(() => {
  const [y, m] = selectedDate.value.split('-').map(Number)
  return y === cursor.value.getFullYear() && m === cursor.value.getMonth() + 1
})

const upcomingCount = computed(
  () =>
    filteredEvents.value.filter((e) => e.status === 'PENDING' && e.eventAt.slice(0, 10) >= todayKey)
      .length,
)

// ------------------------------------------------------------ 交互

function shiftMonth(delta: number): void {
  cursor.value = new Date(cursor.value.getFullYear(), cursor.value.getMonth() + delta, 1)
}

function goToday(): void {
  cursor.value = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  selectedDate.value = todayKey
}

function pickDay(key: string): void {
  selectedDate.value = key
}

function eventsOf(key: string): JobEventVO[] {
  return eventsByDay.value.get(key) ?? []
}

// ------------------------------------------------------------ 弹窗

function suggestTitle(): string {
  const job = jobs.value.find((j) => j.id === form.jobId)
  const label = JOB_EVENT_TYPE_LABELS[form.eventType]
  const company = job?.companyName?.trim()
  return company ? `${company} ${label}` : label
}

/** 职位 / 类型变了就跟着更新标题 —— 但只在用户没手改过的时候 */
function refreshAutoTitle(): void {
  if (form.title.trim() === '' || form.title === autoTitle.value) {
    autoTitle.value = suggestTitle()
    form.title = autoTitle.value
  }
}

watch(() => [form.jobId, form.eventType], refreshAutoTitle)

function openCreate(dateKey?: string): void {
  editing.value = null
  const day = dateKey ?? selectedDate.value
  form.jobId = jobs.value[0]?.id ?? ''
  form.eventType = 'INTERVIEW_1'
  form.title = ''
  form.eventAt = `${day}T10:00:00`
  form.durationMinutes = 60
  form.eventMode = 'ONLINE'
  form.location = ''
  form.note = ''
  form.status = 'PENDING'
  autoTitle.value = ''
  refreshAutoTitle()
  dialogVisible.value = true
}

function openEdit(ev: JobEventVO): void {
  editing.value = ev
  form.jobId = ev.jobId
  form.eventType = ev.eventType
  form.title = ev.title
  // 后端返回的是 ISO 本地时间，date-picker 的 value-format 与之对齐
  form.eventAt = ev.eventAt.length === 16 ? `${ev.eventAt}:00` : ev.eventAt
  form.durationMinutes = ev.durationMinutes
  form.eventMode = ev.eventMode ?? ''
  form.location = ev.location ?? ''
  form.note = ev.note ?? ''
  form.status = ev.status
  autoTitle.value = ''
  dialogVisible.value = true
}

function toSaveDTO(ev: JobEventVO, overrides: Partial<JobEventSaveDTO> = {}): JobEventSaveDTO {
  return {
    jobId: ev.jobId,
    eventType: ev.eventType,
    title: ev.title,
    eventAt: ev.eventAt,
    durationMinutes: ev.durationMinutes,
    eventMode: ev.eventMode,
    location: ev.location,
    note: ev.note,
    status: ev.status,
    ...overrides,
  }
}

async function submit(): Promise<void> {
  if (!form.jobId) {
    ElMessage.warning('请选择关联职位')
    return
  }
  if (!form.title.trim()) {
    ElMessage.warning('请填写标题')
    return
  }
  if (!form.eventAt) {
    ElMessage.warning('请选择开始时间')
    return
  }

  const dto: JobEventSaveDTO = {
    jobId: form.jobId,
    eventType: form.eventType,
    title: form.title.trim(),
    eventAt: form.eventAt,
    durationMinutes: form.durationMinutes,
    eventMode: form.eventMode || null,
    location: form.location.trim() || null,
    note: form.note.trim() || null,
    status: form.status,
  }

  submitting.value = true
  try {
    if (editing.value) {
      await calendarApi.update(editing.value.id, dto)
      ElMessage.success('日程已更新')
    } else {
      await calendarApi.create(dto)
      ElMessage.success('日程已添加')
    }
    dialogVisible.value = false
    // 新建的日程可能落在别的月份，跳过去让用户看到结果
    selectedDate.value = form.eventAt.slice(0, 10)
    cursor.value = new Date(
      Number(form.eventAt.slice(0, 4)),
      Number(form.eventAt.slice(5, 7)) - 1,
      1,
    )
    await load()
  } catch (e) {
    fail(e, '保存失败')
  } finally {
    submitting.value = false
  }
}

async function setStatus(ev: JobEventVO, status: JobEventStatus): Promise<void> {
  try {
    await calendarApi.update(ev.id, toSaveDTO(ev, { status }))
    ElMessage.success(`已标记为「${STATUS_LABELS[status]}」`)
    await load()
  } catch (e) {
    fail(e, '操作失败')
  }
}

async function remove(ev: JobEventVO): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除「${ev.title}」？`, '删除日程', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return // 用户取消
  }
  try {
    await calendarApi.remove(ev.id)
    ElMessage.success('已删除')
    await load()
  } catch (e) {
    fail(e, '删除失败')
  }
}

function timeOf(iso: string): string {
  return iso.length >= 16 ? iso.slice(11, 16) : ''
}

onMounted(() => {
  void load()
  void loadJobs()
})

defineExpose({ refresh: load })
</script>

<template>
  <div v-loading="loading" class="cal">
    <!-- ---------- 顶部工具条 ---------- -->
    <div class="cal__bar">
      <div class="cal__nav">
        <el-button text :icon="ArrowLeft" aria-label="上个月" @click="shiftMonth(-1)" />
        <span class="cal__month">{{ monthLabel }}</span>
        <el-button text :icon="ArrowRight" aria-label="下个月" @click="shiftMonth(1)" />
        <el-button size="small" round @click="goToday">今天</el-button>
      </div>

      <div class="cal__meta">
        <span class="cal__count">
          <el-icon><Calendar /></el-icon>
          本屏 {{ filteredEvents.length }} 场 · 待进行 {{ upcomingCount }} 场
        </span>
        <el-button type="primary" :icon="Plus" @click="openCreate()">新建日程</el-button>
      </div>
    </div>

    <p v-if="noJobs" class="cal__hint">
      还没有职位 —— 日程必须挂在一个目标职位上，先去「新建职位」录入一条 JD 吧。
    </p>

    <!-- ---------- 月视图 + 当日清单 ---------- -->
    <div class="cal__body">
      <div class="cal__grid">
        <div v-for="w in WEEKDAYS" :key="w" class="cal__weekday">{{ w }}</div>

        <div
          v-for="d in gridDays"
          :key="d.key"
          class="cal__cell"
          :class="{
            'cal__cell--out': !d.inMonth,
            'cal__cell--today': d.isToday,
            'cal__cell--active': d.key === selectedDate,
            'cal__cell--weekend': d.isWeekend && d.inMonth,
          }"
          @click="pickDay(d.key)"
        >
          <div class="cal__daynum">
            <span>{{ d.day }}</span>
            <span v-if="d.isToday" class="cal__today-tag">今天</span>
          </div>

          <div class="cal__chips">
            <div
              v-for="ev in eventsOf(d.key).slice(0, 2)"
              :key="ev.id"
              class="cal__chip"
              :class="{
                'cal__chip--done': ev.status === 'DONE',
                'cal__chip--cancelled': ev.status === 'CANCELLED',
              }"
              :style="{ '--tone': TYPE_TONE[ev.eventType] }"
              @click.stop="openEdit(ev)"
            >
              <span class="cal__chip-time">{{ timeOf(ev.eventAt) }}</span>
              <span class="cal__chip-text">{{ ev.title }}</span>
            </div>
            <span v-if="eventsOf(d.key).length > 2" class="cal__more">
              +{{ eventsOf(d.key).length - 2 }}
            </span>
          </div>
        </div>
      </div>

      <!-- ---------- 选中日清单 ---------- -->
      <aside class="cal__side">
        <header class="cal__side-head">
          <div>
            <h4 class="cal__side-title">
              {{ selectedDate }}
              <em v-if="!selectedInMonth" class="cal__side-off">非本月</em>
            </h4>
            <p class="cal__side-sub">{{ selectedEvents.length }} 场安排</p>
          </div>
          <el-button text :icon="Plus" @click="openCreate(selectedDate)">加一场</el-button>
        </header>

        <el-empty
          v-if="selectedEvents.length === 0"
          description="这天没有安排"
          :image-size="72"
        />

        <ul v-else class="cal__list">
          <li
            v-for="ev in selectedEvents"
            :key="ev.id"
            class="cal__item"
            :class="{
              'cal__item--done': ev.status === 'DONE',
              'cal__item--cancelled': ev.status === 'CANCELLED',
            }"
            :style="{ '--tone': TYPE_TONE[ev.eventType] }"
          >
            <div class="cal__item-head">
              <span class="cal__item-time">{{ timeOf(ev.eventAt) }}</span>
              <span class="cal__item-type">{{ JOB_EVENT_TYPE_LABELS[ev.eventType] }}</span>
              <span class="cal__item-status">{{ STATUS_LABELS[ev.status] }}</span>
            </div>

            <h5 class="cal__item-title">{{ ev.title }}</h5>

            <p class="cal__item-meta">
              <span v-if="ev.companyName">
                <el-icon><Location /></el-icon>{{ ev.companyName }}
              </span>
              <span v-if="ev.durationMinutes">
                <el-icon><Clock /></el-icon>{{ ev.durationMinutes }} 分钟
              </span>
              <span v-if="ev.eventMode">
                <el-icon><VideoCamera /></el-icon>{{ JOB_EVENT_MODE_LABELS[ev.eventMode] }}
              </span>
            </p>

            <p v-if="ev.location" class="cal__item-line">地点：{{ ev.location }}</p>
            <p v-if="ev.note" class="cal__item-line">备注：{{ ev.note }}</p>

            <div class="cal__item-actions">
              <el-button
                v-if="ev.status === 'PENDING'"
                size="small"
                text
                type="success"
                :icon="Check"
                @click="setStatus(ev, 'DONE')"
              >
                完成
              </el-button>
              <el-button
                v-if="ev.status === 'PENDING'"
                size="small"
                text
                @click="setStatus(ev, 'CANCELLED')"
              >
                取消
              </el-button>
              <el-button
                v-else
                size="small"
                text
                @click="setStatus(ev, 'PENDING')"
              >
                恢复待进行
              </el-button>
              <el-button size="small" text :icon="Edit" @click="openEdit(ev)">编辑</el-button>
              <el-button size="small" text type="danger" :icon="Delete" @click="remove(ev)">
                删除
              </el-button>
            </div>
          </li>
        </ul>
      </aside>
    </div>

    <!-- ---------- 新建 / 编辑 ---------- -->
    <el-dialog
      v-model="dialogVisible"
      :title="editing ? '编辑日程' : '新建日程'"
      width="min(560px, 92vw)"
      append-to-body
    >
      <el-form label-width="76px" label-position="right">
        <el-form-item label="职位" required>
          <el-select v-model="form.jobId" filterable placeholder="选择关联职位" class="form__full">
            <el-option
              v-for="j in jobs"
              :key="j.id"
              :label="j.companyName ? `${j.companyName} · ${j.title}` : j.title"
              :value="j.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="类型" required>
          <el-radio-group v-model="form.eventType">
            <el-radio-button v-for="o in TYPE_OPTIONS" :key="o.value" :value="o.value">
              {{ o.label }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="标题" required>
          <el-input v-model="form.title" maxlength="255" placeholder="如：字节跳动 技术一面" />
        </el-form-item>

        <el-form-item label="开始时间" required>
          <el-date-picker
            v-model="form.eventAt"
            type="datetime"
            placeholder="选择日期与时间"
            format="YYYY-MM-DD HH:mm"
            value-format="YYYY-MM-DDTHH:mm:ss"
            class="form__full"
          />
        </el-form-item>

        <el-form-item label="时长">
          <el-input-number v-model="form.durationMinutes" :min="0" :max="1440" :step="15" />
          <span class="form__unit">分钟（留空表示不确定）</span>
        </el-form-item>

        <el-form-item label="形式">
          <el-radio-group v-model="form.eventMode">
            <el-radio-button v-for="o in MODE_OPTIONS" :key="o.value" :value="o.value">
              {{ o.label }}
            </el-radio-button>
            <el-radio-button value="">未定</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="地点">
          <el-input v-model="form.location" maxlength="500" placeholder="线下地址 / 会议链接" />
        </el-form-item>

        <el-form-item label="备注">
          <el-input
            v-model="form.note"
            type="textarea"
            :rows="2"
            maxlength="1000"
            show-word-limit
            placeholder="面试官、准备要点"
          />
        </el-form-item>

        <el-form-item v-if="editing" label="状态">
          <el-radio-group v-model="form.status">
            <el-radio-button v-for="o in STATUS_OPTIONS" :key="o.value" :value="o.value">
              {{ o.label }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submit">
          {{ editing ? '保存' : '添加' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
/* ---------- 顶部工具条 ---------- */
.cal__bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.cal__nav {
  display: flex;
  gap: 4px;
  align-items: center;
}

.cal__month {
  min-width: 116px;
  font-size: var(--mf-font-md);
  font-weight: 600;
  text-align: center;
  color: var(--mf-text-primary);
}

.cal__meta {
  display: flex;
  gap: 12px;
  align-items: center;
}

.cal__count {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

.cal__hint {
  margin: 0 0 12px;
  padding: 10px 14px;
  font-size: var(--mf-font-sm);
  color: var(--mf-text-secondary);
  background-color: var(--mf-bg-subtle);
  border-radius: var(--mf-radius-md);
}

/* ---------- 布局：日历 + 侧栏 ---------- */
.cal__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 16px;
  align-items: start;
}

@media (width <= 960px) {
  .cal__body {
    grid-template-columns: minmax(0, 1fr);
  }
}

/* ---------- 月视图 ---------- */
.cal__grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  background-color: var(--mf-glass-card);
  border: 1px solid var(--mf-glass-border-soft);
  border-radius: var(--mf-radius-lg);
  overflow: hidden;
}

.cal__weekday {
  padding: 8px 0;
  font-size: var(--mf-font-xs);
  font-weight: 500;
  color: var(--mf-text-tertiary);
  text-align: center;
  background-color: var(--mf-bg-subtle);
}

.cal__cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
  /* 固定最小高度：不然「有日程的天」会被撑高，整块网格高低不平 */
  min-height: 92px;
  padding: 6px 6px 8px;
  cursor: pointer;
  border-top: 1px solid var(--mf-glass-border-soft);
  border-right: 1px solid var(--mf-glass-border-soft);
  transition: background-color var(--mf-duration-fast) var(--mf-ease-out);
}

.cal__cell:nth-child(7n + 7) {
  border-right: none;
}

.cal__cell:hover {
  background-color: var(--mf-bg-hover);
}

.cal__cell--out {
  background-color: var(--mf-bg-subtle);
}

.cal__cell--out .cal__daynum {
  color: var(--mf-text-tertiary);
}

.cal__cell--weekend .cal__daynum {
  color: var(--mf-text-secondary);
}

.cal__cell--active {
  box-shadow: inset 0 0 0 2px var(--mf-primary);
}

.cal__daynum {
  display: flex;
  gap: 4px;
  align-items: center;
  font-size: var(--mf-font-sm);
  font-weight: 600;
  color: var(--mf-text-primary);
}

.cal__cell--today .cal__daynum {
  color: var(--mf-primary);
}

.cal__today-tag {
  padding: 0 5px;
  font-size: 10px;
  font-weight: 500;
  color: #fff;
  background-color: var(--mf-primary);
  border-radius: var(--mf-radius-pill);
}

.cal__chips {
  display: flex;
  flex-direction: column;
  gap: 3px;
  overflow: hidden;
}

.cal__chip {
  display: flex;
  gap: 4px;
  align-items: center;
  padding: 2px 5px;
  font-size: 11px;
  line-height: 1.4;
  color: var(--mf-text-primary);
  cursor: pointer;
  background-color: color-mix(in srgb, var(--tone) 14%, transparent);
  border-left: 3px solid var(--tone);
  border-radius: var(--mf-radius-sm);
}

.cal__chip:hover {
  background-color: color-mix(in srgb, var(--tone) 26%, transparent);
}

.cal__chip-time {
  flex: none;
  font-family: var(--mf-font-mono, monospace);
  color: var(--mf-text-secondary);
}

.cal__chip-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cal__chip--cancelled {
  opacity: 0.5;
}

.cal__chip--cancelled .cal__chip-text {
  text-decoration: line-through;
}

.cal__chip--done .cal__chip-text {
  color: var(--mf-text-tertiary);
}

.cal__more {
  padding-left: 5px;
  font-size: 11px;
  color: var(--mf-text-tertiary);
}

/* ---------- 侧栏 ---------- */
.cal__side {
  padding: 14px;
  background-color: var(--mf-glass-card);
  border: 1px solid var(--mf-glass-border-soft);
  border-radius: var(--mf-radius-lg);
}

.cal__side-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 10px;
}

.cal__side-title {
  margin: 0;
  font-size: var(--mf-font-md);
  font-weight: 600;
  color: var(--mf-text-primary);
}

.cal__side-off {
  margin-left: 4px;
  font-size: var(--mf-font-xs);
  font-style: normal;
  font-weight: 400;
  color: var(--mf-text-tertiary);
}

.cal__side-sub {
  margin: 2px 0 0;
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

.cal__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0;
  margin: 0;
  list-style: none;
}

.cal__item {
  padding: 10px 12px;
  background-color: var(--mf-bg-elevated);
  border-left: 3px solid var(--tone);
  border-radius: var(--mf-radius-md);
}

.cal__item--cancelled {
  opacity: 0.55;
}

.cal__item-head {
  display: flex;
  gap: 6px;
  align-items: center;
  font-size: var(--mf-font-xs);
}

.cal__item-time {
  font-family: var(--mf-font-mono, monospace);
  font-weight: 600;
  color: var(--mf-text-primary);
}

.cal__item-type {
  padding: 0 6px;
  color: #fff;
  background-color: var(--tone);
  border-radius: var(--mf-radius-pill);
}

.cal__item-status {
  margin-left: auto;
  color: var(--mf-text-tertiary);
}

.cal__item-title {
  margin: 6px 0 4px;
  font-size: var(--mf-font-sm);
  font-weight: 600;
  color: var(--mf-text-primary);
}

.cal__item--done .cal__item-title {
  color: var(--mf-text-tertiary);
  text-decoration: line-through;
}

.cal__item-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  margin: 0 0 4px;
  font-size: var(--mf-font-xs);
  color: var(--mf-text-secondary);
}

.cal__item-meta span {
  display: inline-flex;
  gap: 3px;
  align-items: center;
}

.cal__item-line {
  margin: 0 0 2px;
  font-size: var(--mf-font-xs);
  color: var(--mf-text-secondary);
}

.cal__item-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  margin-top: 8px;
}

/* ---------- 弹窗内的细节 ---------- */
.form__full {
  width: 100%;
}

.form__unit {
  margin-left: 8px;
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}
</style>
