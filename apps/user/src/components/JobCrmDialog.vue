<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  BizError,
  type JobApplicationStage,
  type JobCrmUpdateDTO,
  type JobKanbanCardVO,
  type ResumeVO,
} from '@mindforge/shared'

import { jobApi } from '@/api/job'
import { resumeApi } from '@/api/resume'

const props = defineProps<{
  job: {
    id: string
    title: string
    companyName?: string | null
    applicationStage?: JobApplicationStage
    linkedResumeId?: string | null
    salaryOffer?: string | null
    nextActionAt?: string | null
    crmNotes?: string | null
  } | null
}>()

const visible = defineModel<boolean>({ default: false })
const emit = defineEmits<{
  (e: 'saved', updated: JobKanbanCardVO): void
}>()

const STAGE_OPTIONS: Array<{ label: string; value: JobApplicationStage }> = [
  { label: '心愿 / 待投递', value: 'WISHLIST' },
  { label: '已投递', value: 'APPLIED' },
  { label: '初筛 / 笔试', value: 'SCREENING' },
  { label: '技术一面', value: 'INTERVIEW_1' },
  { label: '技术二面 / 终面', value: 'INTERVIEW_2' },
  { label: 'HR 面 / 谈薪', value: 'HR' },
  { label: '已获 Offer', value: 'OFFER' },
  { label: '未通过 / 已归档', value: 'REJECTED' },
]

const saving = ref(false)
const resumes = ref<ResumeVO[]>([])
const loadingResumes = ref(false)

const form = ref<JobCrmUpdateDTO>({
  applicationStage: 'WISHLIST',
  linkedResumeId: '',
  salaryOffer: '',
  nextActionAt: null,
  crmNotes: '',
})

async function loadResumes(): Promise<void> {
  loadingResumes.value = true
  try {
    const res = await resumeApi.page({ page: 1, pageSize: 100 })
    resumes.value = res.records
  } catch {
    // 忽略加载简历异常
  } finally {
    loadingResumes.value = false
  }
}

watch(
  () => props.job,
  (j) => {
    if (j) {
      form.value = {
        applicationStage: j.applicationStage ?? 'WISHLIST',
        linkedResumeId: j.linkedResumeId ?? '',
        salaryOffer: j.salaryOffer ?? '',
        nextActionAt: j.nextActionAt ?? null,
        crmNotes: j.crmNotes ?? '',
      }
    }
  },
  { immediate: true },
)

watch(visible, (open) => {
  if (open && resumes.value.length === 0) {
    void loadResumes()
  }
})

async function onSave(): Promise<void> {
  if (!props.job) return
  saving.value = true
  try {
    const payload: JobCrmUpdateDTO = {
      applicationStage: form.value.applicationStage,
      linkedResumeId: form.value.linkedResumeId || '',
      salaryOffer: form.value.salaryOffer?.trim() || '',
      nextActionAt: form.value.nextActionAt || null,
      // ★ 时间框空着 = 明确要求清空提醒。后端「没传该字段」和「传 null」反序列化后
      //   都是 null，光靠 nextActionAt 表达不了「清空」，必须靠这个显式标志。
      //   时间填了的话后端以 nextActionAt 为准，两个一起传不会互相打架，所以这里无脑带上。
      clearNextActionAt: !form.value.nextActionAt,
      crmNotes: form.value.crmNotes?.trim() || '',
    }
    const updated = await jobApi.updateCrm(props.job.id, payload)
    ElMessage.success('跟进记录已更新')
    emit('saved', updated)
    visible.value = false
  } catch (e) {
    ElMessage.error(e instanceof BizError ? e.message : '更新跟进信息失败')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="`求职投递跟进 · ${props.job?.companyName || ''} ${props.job?.title || ''}`"
    width="min(560px, 92vw)"
    destroy-on-close
    append-to-body
  >
    <el-form label-position="top" class="crm-form">
      <el-form-item label="当前投递推进阶段">
        <el-select v-model="form.applicationStage" class="w-full">
          <el-option
            v-for="st in STAGE_OPTIONS"
            :key="st.value"
            :label="st.label"
            :value="st.value"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="投递目标简历">
        <el-select
          v-model="form.linkedResumeId"
          placeholder="选择针对该岗位投递或定制的简历"
          clearable
          :loading="loadingResumes"
          class="w-full"
        >
          <el-option label="暂不绑定专属简历" value="" />
          <el-option
            v-for="r in resumes"
            :key="r.id"
            :label="`${r.name} (${r.targetPosition || '通用版本'})`"
            :value="r.id"
          />
        </el-select>
      </el-form-item>

      <div class="form-row">
        <el-form-item label="目标 / 薪资 Offer" class="form-col">
          <el-input
            v-model="form.salaryOffer"
            maxlength="64"
            placeholder="如 28k*16 或 年薪 45W"
            clearable
          />
        </el-form-item>

        <el-form-item label="下一场日程提醒（笔试 / 面试）" class="form-col">
          <el-date-picker
            v-model="form.nextActionAt"
            type="datetime"
            value-format="YYYY-MM-DDTHH:mm:ss"
            placeholder="选择面试/笔试提醒时间"
            class="w-full"
          />
        </el-form-item>
      </div>

      <p class="crm-hint">
        提醒时间清空后，看板卡片上就不再出现这条待办；日历里的面试场次不受影响。
      </p>

      <el-form-item label="求职跟进备忘 / 复盘笔记">
        <el-input
          v-model="form.crmNotes"
          type="textarea"
          :rows="4"
          maxlength="1000"
          show-word-limit
          placeholder="可记录 HR 微信/手机、腾讯会议号、岗位特殊要求、一面被问核心点、后续待办备忘等…"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="onSave">保存跟进记录</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.crm-form {
  padding-top: var(--mf-space-1);
}

.w-full {
  width: 100%;
}

.form-row {
  display: flex;
  gap: var(--mf-space-4);
}

.form-col {
  flex: 1;
  min-width: 0;
}

.crm-hint {
  margin: calc(var(--mf-space-2) * -1) 0 var(--mf-space-4);
  font-size: var(--mf-font-xs);
  line-height: 1.6;
  color: var(--mf-text-secondary);
}
</style>
