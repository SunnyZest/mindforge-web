<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'

import { BizError, type OfferCreateDTO, type OfferUpdateDTO, type OfferVO } from '@mindforge/shared'

import { offerApi } from '@/api/offer'

/**
 * Offer 录入 / 编辑弹窗。
 *
 * 五个维度都是 1-10 的主观打分（用户自己权衡），薪资数字只作展示参考不参与算分。
 * ⚠️ 用 slider 而不是输入框：一眼能看到当前在量程的哪个位置，也不用防着用户填 99。
 */

const props = defineProps<{
  modelValue: boolean
  /** 编辑的 Offer；null = 新增 */
  offer: OfferVO | null
  /** 从投递看板导入时预填的职位信息 */
  prefillJob?: { id: string; title: string; companyName: string | null } | null
}>()

const emit = defineEmits<{
  'update:modelValue': [visible: boolean]
  saved: []
}>()

/** 五个维度的元信息。⚠️ wlb / commute 是「越大越好」，标签要说清方向 */
const DIMENSIONS = [
  { key: 'salaryScore', label: '薪资包', hint: '你对这个薪资包的满意度' },
  { key: 'techScore', label: '技术栈发展', hint: '技术栈新不新、能不能涨本事' },
  { key: 'brandScore', label: '平台背书', hint: '公司名气、这段经历写在简历上好不好看' },
  { key: 'wlbScore', label: '加班强度', hint: '分越高越轻松（10 = 几乎不加班）' },
  { key: 'commuteScore', label: '通勤距离', hint: '分越高越方便（10 = 步行/10 分钟内）' },
] as const

const form = reactive({
  companyName: '',
  positionName: '',
  salaryAnnual: null as number | null,
  salaryScore: 5,
  techScore: 5,
  brandScore: 5,
  wlbScore: 5,
  commuteScore: 5,
  dimensionNotes: '',
})

const submitting = ref(false)

const isEdit = computed(() => Boolean(props.offer))

/**
 * ⚠️ 每次打开都按当前 offer 重置表单。
 * 不重置的隐患：编辑过 A 之后直接打开 B，A 的分数还留在表单里 ——
 * 用户不细看就保存，等于把 A 的评分写给了 B（遮罩挡着也不该有这种隐患）。
 */
watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    const o = props.offer
    form.companyName = o?.companyName ?? props.prefillJob?.companyName ?? ''
    form.positionName = o?.positionName ?? props.prefillJob?.title ?? ''
    form.salaryAnnual = o?.salaryAnnual ?? null
    form.salaryScore = o?.salaryScore ?? 5
    form.techScore = o?.techScore ?? 5
    form.brandScore = o?.brandScore ?? 5
    form.wlbScore = o?.wlbScore ?? 5
    form.commuteScore = o?.commuteScore ?? 5
    form.dimensionNotes = o?.dimensionNotes ?? ''
  },
)

function close(): void {
  emit('update:modelValue', false)
}

async function submit(): Promise<void> {
  if (!form.companyName.trim()) {
    ElMessage.warning('请填写公司名')
    return
  }
  submitting.value = true
  try {
    if (props.offer) {
      // 局部更新：只传字段，后端的 LambdaUpdateWrapper 只更新非 null 的那些
      const dto: OfferUpdateDTO = {
        companyName: form.companyName.trim(),
        positionName: form.positionName.trim(),
        salaryAnnual: form.salaryAnnual ?? undefined,
        salaryScore: form.salaryScore,
        techScore: form.techScore,
        brandScore: form.brandScore,
        wlbScore: form.wlbScore,
        commuteScore: form.commuteScore,
        dimensionNotes: form.dimensionNotes,
      }
      await offerApi.update(props.offer.id, dto)
      ElMessage.success('已保存')
    } else {
      const dto: OfferCreateDTO = {
        companyName: form.companyName.trim(),
        positionName: form.positionName.trim() || undefined,
        salaryAnnual: form.salaryAnnual ?? undefined,
        salaryScore: form.salaryScore,
        techScore: form.techScore,
        brandScore: form.brandScore,
        wlbScore: form.wlbScore,
        commuteScore: form.commuteScore,
        dimensionNotes: form.dimensionNotes || undefined,
        // 从投递看板导入时带上，便于之后回溯 JD
        jobId: props.prefillJob?.id,
      }
      await offerApi.create(dto)
      ElMessage.success('已添加')
    }
    emit('saved')
    close()
  } catch (e) {
    ElMessage.error(e instanceof BizError ? e.message : '保存失败')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="isEdit ? '编辑 Offer' : '添加 Offer'"
    width="min(560px, 92vw)"
    append-to-body
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-form label-width="96px" @submit.prevent="submit">
      <el-form-item label="公司名" required>
        <el-input v-model="form.companyName" maxlength="255" placeholder="必填" />
      </el-form-item>

      <el-form-item label="岗位名">
        <el-input v-model="form.positionName" maxlength="255" placeholder="可空" />
      </el-form-item>

      <el-form-item label="年薪（万元）">
        <el-input-number
          v-model="form.salaryAnnual"
          :min="0"
          :max="99999999"
          :precision="2"
          controls-position="right"
          style="width: 200px"
        />
        <span class="form__hint">只用于展示参考，不参与算分</span>
      </el-form-item>

      <el-divider class="form__divider">五个维度打分（1~10）</el-divider>

      <el-form-item v-for="d in DIMENSIONS" :key="d.key" :label="d.label">
        <div class="form__row">
          <el-slider
            v-model="form[d.key]"
            :min="1"
            :max="10"
            :step="1"
            show-stops
            style="flex: 1"
          />
          <span class="form__score">{{ form[d.key] }}</span>
        </div>
        <div class="form__hint">{{ d.hint }}</div>
      </el-form-item>

      <el-form-item label="打分理由">
        <el-input
          v-model="form.dimensionNotes"
          type="textarea"
          :rows="3"
          maxlength="2000"
          placeholder="可空。写清楚为什么这么打分，过几个月再回看不会忘了当时怎么想的"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="close">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submit">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.form__row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.form__score {
  min-width: 24px;
  text-align: center;
  font-weight: 500;
  color: var(--mf-text-primary);
}

.form__hint {
  margin-left: 8px;
  font-size: var(--mf-font-xs, 12px);
  color: var(--mf-text-tertiary);
}

.form__divider {
  margin: 8px 0 20px;
}
</style>
