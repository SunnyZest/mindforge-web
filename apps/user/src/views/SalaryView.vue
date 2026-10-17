<script setup lang="ts">
import { InfoFilled, TrendCharts } from '@element-plus/icons-vue'
import { computed, onMounted, reactive, ref } from 'vue'

import { BizError, type SalaryConfidence, type SalaryEstimateVO } from '@mindforge/shared'

import { salaryApi } from '@/api/salary'

/**
 * 薪酬测算（AI 参考区间）。
 *
 * ★ 这一页最重要的不是把数字画得好看，而是**别让人把它当行情**：
 *   1. 标题与说明里写清「AI 估算」，页面上不出现「市场均价」这类词；
 *   2. 置信度与免责声明永远可见，不折叠、不藏进 tooltip；
 *   3. 不展示样本量 —— 后端没有，编一个比不给更糟。
 */

const EDUCATION_OPTIONS = ['大专', '本科', '硕士', '博士']
const COMPANY_OPTIONS = ['大厂', '中厂', '创业', '国企', '外企']

const CONFIDENCE_META: Record<
  SalaryConfidence,
  { label: string; type: 'success' | 'warning' | 'info'; hint: string }
> = {
  HIGH: {
    label: '较高',
    type: 'success',
    hint: '常见城市 + 常见岗位 + 常规年限，区间参考价值相对高',
  },
  MEDIUM: {
    label: '一般',
    type: 'warning',
    hint: '城市或岗位不在常见组合里，区间可能偏宽',
  },
  LOW: {
    label: '较低',
    type: 'info',
    hint: '城市与岗位都少见，这个区间只能当数量级参考',
  },
}

const form = reactive({
  city: '',
  position: '',
  yearsOfExperience: 3,
  education: '',
  companyType: '',
  skills: [] as string[],
})

/** 用户按「万」填，提交时换成元 —— 后端只认元 */
const currentSalaryWan = ref<number | null>(null)

const loading = ref(false)
const result = ref<SalaryEstimateVO | null>(null)

const history = ref<SalaryEstimateVO[]>([])
const historyTotal = ref(0)
const historyPage = ref(1)
const historyLoading = ref(false)

const confidence = computed(() =>
  result.value?.confidence ? CONFIDENCE_META[result.value.confidence] : null,
)

/** 万 → 元；空值不传 */
function toYuan(wan: number | null): number | undefined {
  return wan === null || wan <= 0 ? undefined : Math.round(wan * 10000)
}

function moneyK(value: number | null): string {
  return value === null ? '--' : `${(value / 1000).toFixed(1)}K`
}

function moneyWan(value: number | null): string {
  return value === null ? '--' : `${(value / 10000).toFixed(1)} 万`
}

function fail(e: unknown, fallback: string): void {
  ElMessage.error(e instanceof BizError ? e.message : fallback)
}

async function estimate(): Promise<void> {
  if (!form.city.trim() || !form.position.trim()) {
    ElMessage.warning('城市和岗位是必填的')
    return
  }

  loading.value = true
  try {
    result.value = await salaryApi.estimate({
      city: form.city.trim(),
      position: form.position.trim(),
      yearsOfExperience: form.yearsOfExperience,
      education: form.education || undefined,
      companyType: form.companyType || undefined,
      skills: form.skills.length ? form.skills : undefined,
      currentAnnualSalary: toYuan(currentSalaryWan.value),
    })

    if (result.value.cached) {
      ElMessage.info('参数没变，直接给你上次的结果（7 天内同参数不重复估算）')
    }
    await loadHistory(1)
  } catch (e) {
    fail(e, '估算失败，请稍后重试')
  } finally {
    loading.value = false
  }
}

async function loadHistory(page = historyPage.value): Promise<void> {
  historyLoading.value = true
  try {
    const res = await salaryApi.history({ page, pageSize: 10 })
    history.value = res.records
    historyTotal.value = res.total
    historyPage.value = page
  } catch (e) {
    fail(e, '加载历史失败')
  } finally {
    historyLoading.value = false
  }
}

/** 点历史记录回看（不是重新估算，所以不显示 cached 提示） */
function showHistory(item: SalaryEstimateVO): void {
  result.value = item
}

onMounted(() => {
  void loadHistory(1)
})
</script>

<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h2 class="page__title">薪酬测算</h2>
        <p class="page__desc">
          按城市、岗位、年限推算一个参考区间。这是
          <strong>AI 估算，不是市场行情</strong>
          —— 系统没有真实薪酬样本，结果只用来判断数量级，不能拿去谈薪。
        </p>
      </div>
    </header>

    <el-card class="page__card" shadow="never">
      <el-form :model="form" label-width="88px" @submit.prevent>
        <el-row :gutter="16">
          <el-col :xs="24" :sm="12" :md="8">
            <el-form-item label="城市" required>
              <el-input v-model="form.city" placeholder="如：杭州" maxlength="64" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12" :md="8">
            <el-form-item label="岗位" required>
              <el-input v-model="form.position" placeholder="如：Java 后端开发" maxlength="128" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12" :md="8">
            <el-form-item label="工作年限" required>
              <el-input-number v-model="form.yearsOfExperience" :min="0" :max="40" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12" :md="8">
            <el-form-item label="学历">
              <el-select v-model="form.education" placeholder="可不填" clearable>
                <el-option v-for="e in EDUCATION_OPTIONS" :key="e" :label="e" :value="e" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12" :md="8">
            <el-form-item label="公司类型">
              <el-select v-model="form.companyType" placeholder="可不填" clearable>
                <el-option v-for="c in COMPANY_OPTIONS" :key="c" :label="c" :value="c" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12" :md="8">
            <el-form-item label="当前年包">
              <el-input-number
                v-model="currentSalaryWan"
                :min="0"
                :max="1000"
                :precision="1"
                :step="1"
                placeholder="万元"
              />
              <span class="form__unit">万元</span>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="技术栈">
              <el-select
                v-model="form.skills"
                multiple
                filterable
                allow-create
                default-first-option
                :multiple-limit="20"
                placeholder="输入后回车添加，如 Java、Flink"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <div class="form__actions">
          <el-button type="primary" :loading="loading" @click="estimate">
            <el-icon><TrendCharts /></el-icon>
            开始估算
          </el-button>
          <span class="form__hint">同参数 7 天内不会重复估算，直接给你上次的结果</span>
        </div>
      </el-form>
    </el-card>

    <el-card v-if="result" v-loading="loading" class="page__card" shadow="never">
      <div class="result__head">
        <div>
          <h3 class="result__title">
            {{ result.city }} · {{ result.position }} · {{ result.yearsOfExperience }} 年
          </h3>
          <p class="result__sub">
            <span v-if="result.education">{{ result.education }}</span>
            <span v-if="result.companyType"> · {{ result.companyType }}</span>
            <span v-if="result.monthsPerYear"> · 按 {{ result.monthsPerYear }} 个月估算</span>
          </p>
        </div>
        <el-tag v-if="confidence" :type="confidence.type" effect="plain" size="large">
          置信度：{{ confidence.label }}
        </el-tag>
      </div>

      <div class="ranges">
        <div v-for="p in ['50', '75', '90']" :key="p" class="range">
          <div class="range__label">P{{ p }}</div>
          <div class="range__monthly">
            {{
              moneyK(
                p === '50' ? result.monthlyP50 : p === '75' ? result.monthlyP75 : result.monthlyP90,
              )
            }}
            <span class="range__unit">/ 月</span>
          </div>
          <div class="range__annual">
            年包
            {{
              moneyWan(
                p === '50' ? result.annualP50 : p === '75' ? result.annualP75 : result.annualP90,
              )
            }}
          </div>
        </div>
      </div>

      <p v-if="confidence" class="result__confidence">{{ confidence.hint }}</p>

      <div class="notes">
        <div class="notes__block">
          <h4 class="notes__title">估算依据</h4>
          <ul class="notes__list">
            <li v-for="(b, i) in result.basis" :key="`b-${i}`">{{ b }}</li>
            <li v-if="!result.basis.length" class="notes__empty">模型没有给出具体依据</li>
          </ul>
        </div>
        <div class="notes__block">
          <h4 class="notes__title">加减分项</h4>
          <ul class="notes__list">
            <li v-for="(f, i) in result.factors" :key="`f-${i}`">{{ f }}</li>
            <li v-if="!result.factors.length" class="notes__empty">没有额外的加减分项</li>
          </ul>
        </div>
      </div>

      <el-alert
        v-if="result.caveat"
        class="result__caveat"
        type="info"
        :closable="false"
        show-icon
      >
        <template #icon>
          <el-icon><InfoFilled /></el-icon>
        </template>
        {{ result.caveat }}
      </el-alert>
    </el-card>

    <el-card class="page__card" shadow="never">
      <div class="history__head">
        <h3 class="history__title">估算历史</h3>
        <span class="history__hint">点一行可以回看当时的区间</span>
      </div>

      <el-table
        v-loading="historyLoading"
        :data="history"
        size="small"
        @row-click="showHistory"
      >
        <el-table-column label="时间" width="170">
          <template #default="{ row }">{{ row.createdAt }}</template>
        </el-table-column>
        <el-table-column prop="city" label="城市" width="100" />
        <el-table-column prop="position" label="岗位" min-width="160" />
        <el-table-column label="年限" width="80">
          <template #default="{ row }">{{ row.yearsOfExperience }} 年</template>
        </el-table-column>
        <el-table-column label="月薪 P50" width="110">
          <template #default="{ row }">{{ moneyK(row.monthlyP50) }}</template>
        </el-table-column>
        <el-table-column label="年包 P50" width="120">
          <template #default="{ row }">{{ moneyWan(row.annualP50) }}</template>
        </el-table-column>
        <el-table-column label="置信度" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.confidence" :type="CONFIDENCE_META[row.confidence as SalaryConfidence].type" size="small" effect="plain">
              {{ CONFIDENCE_META[row.confidence as SalaryConfidence].label }}
            </el-tag>
            <span v-else>--</span>
          </template>
        </el-table-column>
      </el-table>

      <div class="page__pager">
        <el-pagination
          layout="total, prev, pager, next"
          :total="historyTotal"
          :page-size="10"
          :current-page="historyPage"
          @current-change="loadHistory"
        />
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-4, 16px);
}

.page__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--mf-space-4, 16px);
}

.page__title {
  margin: 0 0 6px;
  font-size: var(--mf-font-xl, 20px);
  font-weight: 500;
}

.page__desc {
  margin: 0;
  font-size: var(--mf-font-sm, 13px);
  color: var(--mf-text-secondary);
  line-height: 1.6;
  max-width: 720px;
}

.page__card {
  flex: none;
}

.page__pager {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--mf-space-3, 12px);
}

.form__unit {
  margin-left: 8px;
  font-size: var(--mf-font-xs, 12px);
  color: var(--mf-text-tertiary);
}

.form__actions {
  display: flex;
  align-items: center;
  gap: var(--mf-space-3, 12px);
}

.form__hint {
  font-size: var(--mf-font-xs, 12px);
  color: var(--mf-text-tertiary);
}

.result__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--mf-space-3, 12px);
  margin-bottom: var(--mf-space-4, 16px);
}

.result__title {
  margin: 0 0 4px;
  font-size: var(--mf-font-md, 15px);
  font-weight: 500;
}

.result__sub {
  margin: 0;
  font-size: var(--mf-font-xs, 12px);
  color: var(--mf-text-tertiary);
}

.ranges {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--mf-space-3, 12px);
}

@media (max-width: 720px) {
  .ranges {
    grid-template-columns: 1fr;
  }
}

.range {
  padding: var(--mf-space-3, 12px);
  border: 1px solid var(--mf-border-subtle, rgba(0, 0, 0, 0.06));
  border-radius: var(--mf-radius-md, 10px);
  background: var(--mf-fill-subtle, rgba(0, 0, 0, 0.02));
}

.range__label {
  font-size: var(--mf-font-xs, 12px);
  color: var(--mf-text-tertiary);
  margin-bottom: 6px;
}

.range__monthly {
  font-size: var(--mf-font-xl, 20px);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--mf-text-primary);
}

.range__unit {
  font-size: var(--mf-font-xs, 12px);
  font-weight: 400;
  color: var(--mf-text-tertiary);
}

.range__annual {
  margin-top: 4px;
  font-size: var(--mf-font-xs, 12px);
  color: var(--mf-text-secondary);
  font-variant-numeric: tabular-nums;
}

.result__confidence {
  margin: var(--mf-space-3, 12px) 0 0;
  font-size: var(--mf-font-xs, 12px);
  color: var(--mf-text-tertiary);
}

.notes {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--mf-space-4, 16px);
  margin-top: var(--mf-space-4, 16px);
}

@media (max-width: 720px) {
  .notes {
    grid-template-columns: 1fr;
  }
}

.notes__title {
  margin: 0 0 6px;
  font-size: var(--mf-font-sm, 13px);
  font-weight: 500;
  color: var(--mf-text-primary);
}

.notes__list {
  margin: 0;
  padding-left: 18px;
  font-size: var(--mf-font-sm, 13px);
  color: var(--mf-text-secondary);
  line-height: 1.7;
}

.notes__empty {
  list-style: none;
  margin-left: -18px;
  color: var(--mf-text-tertiary);
}

.result__caveat {
  margin-top: var(--mf-space-4, 16px);
}

.history__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: var(--mf-space-3, 12px);
}

.history__title {
  margin: 0;
  font-size: var(--mf-font-md, 15px);
  font-weight: 500;
}

.history__hint {
  font-size: var(--mf-font-xs, 12px);
  color: var(--mf-text-tertiary);
}
</style>
