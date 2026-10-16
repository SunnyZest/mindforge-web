<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus'
import { onMounted, reactive, ref, watch } from 'vue'

import {
  BizError,
  type InterviewCreateDTO,
  type InterviewDifficulty,
  type InterviewType,
  type JobVO,
  type ResumeVO,
} from '@mindforge/shared'

import { interviewApi } from '@/api/interview'
import { jobApi } from '@/api/job'
import { resumeApi } from '@/api/resume'

const visible = defineModel<boolean>({ required: true })
const emit = defineEmits<{ created: [id: string] }>()

const formRef = ref<FormInstance>()
const saving = ref(false)
const loadingRefs = ref(false)

const resumes = ref<ResumeVO[]>([])
const jobs = ref<JobVO[]>([])

const form = reactive({
  title: '',
  resumeId: '',
  jobId: '',
  interviewType: 'TECHNICAL' as InterviewType,
  difficulty: 'MEDIUM' as InterviewDifficulty,
  questionCount: 5,
})

const rules: FormRules<typeof form> = {
  title: [{ max: 255, message: '最长 255 个字符', trigger: 'blur' }],
  questionCount: [
    { required: true, message: '请选择题目数量', trigger: 'change' },
    // 上下限照抄后端的 @Min(1) / @Max(20)
    { type: 'number', min: 1, max: 20, message: '1~20 道', trigger: 'change' },
  ],
}

const TYPES: { value: InterviewType; label: string; desc: string }[] = [
  { value: 'TECHNICAL', label: '技术面', desc: '考察技术深度' },
  { value: 'BEHAVIORAL', label: '行为面', desc: '考察经历与协作' },
  { value: 'MIXED', label: '综合面', desc: '两者混合' },
]

const DIFFICULTIES: { value: InterviewDifficulty; label: string }[] = [
  { value: 'EASY', label: '简单' },
  { value: 'MEDIUM', label: '中等' },
  { value: 'HARD', label: '困难' },
]

/** 拉可选的简历和职位 —— 都只取已解析的（没解析的话 AI 没东西可依） */
async function loadRefs(): Promise<void> {
  loadingRefs.value = true
  try {
    const [r, j] = await Promise.all([
      resumeApi.page({ page: 1, pageSize: 50 }),
      jobApi.page({ page: 1, pageSize: 50 }),
    ])
    resumes.value = r.records
    jobs.value = j.records
  } catch {
    // 拉不到不影响创建 —— 这两个都是可空的，用户可以开「通用面试」
    resumes.value = []
    jobs.value = []
  } finally {
    loadingRefs.value = false
  }
}

/**
 * 每次打开都清空。
 *
 * ⚠️ 必须做：`destroy-on-close` 只销毁 el-form 这个组件实例，
 *    上面那个 `reactive(form)` 对象是【本组件自己的】，会一直留着 ——
 *    不清的话第二次打开会看到上次填的标题和选项。
 */
watch(visible, (open) => {
  if (open) reset()
})

function reset(): void {
  form.title = ''
  form.resumeId = ''
  form.jobId = ''
  form.interviewType = 'TECHNICAL'
  form.difficulty = 'MEDIUM'
  form.questionCount = 5
  formRef.value?.clearValidate()
}

onMounted(loadRefs)

async function onSubmit(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  // ⚠️ 这条不在 el-form 的 rules 里：它跨两个字段，用 rules 表达不了
  if (!form.resumeId && !form.jobId) {
    ElMessage.warning('简历和职位至少要选一个')
    return
  }

  saving.value = true
  try {
    // ⚠️ 空串要转 undefined —— 后端把空串当成「传了个空 id」会去查库然后报错，
    //    而 undefined 才是「不传这个字段」的语义。
    const dto: InterviewCreateDTO = {
      title: form.title.trim() || undefined,
      resumeId: form.resumeId || undefined,
      jobId: form.jobId || undefined,
      interviewType: form.interviewType,
      difficulty: form.difficulty,
      questionCount: form.questionCount,
    }
    const created = await interviewApi.create(dto)
    ElMessage.success('已创建，接着点「生成题目」')
    visible.value = false
    emit('created', created.id)
  } catch (e) {
    ElMessage.error(e instanceof BizError ? e.message : '创建失败')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <!-- ⚠️ append-to-body 不能少（卡片有 backdrop-filter + overflow:hidden，不加会被裁） -->
  <el-dialog v-model="visible" title="新建模拟面试" width="min(600px, 92vw)" append-to-body destroy-on-close>
    <el-form
      ref="formRef"
      v-loading="loadingRefs"
      :model="form"
      :rules="rules"
      label-position="top"
      @submit.prevent="onSubmit"
    >
      <el-form-item label="面试标题" prop="title">
        <el-input v-model="form.title" placeholder="留空则按职位/简历自动生成" maxlength="255" />
      </el-form-item>

      <!-- 这两个都可空 —— 不选就是「通用面试」，AI 只按类型和难度出题 -->
      <div class="row">
        <el-form-item label="基于简历">
          <el-select v-model="form.resumeId" placeholder="不选这个" clearable>
            <el-option
              v-for="r in resumes"
              :key="r.id"
              :label="r.name"
              :value="r.id"
              :disabled="r.parseStatus !== 'SUCCESS'"
            >
              <span>{{ r.name }}</span>
              <!-- 没解析的标出来并禁用 —— 后端没结构化数据可用，出了题也不贴简历 -->
              <span v-if="r.parseStatus !== 'SUCCESS'" class="opt__hint">（未解析）</span>
            </el-option>
          </el-select>
        </el-form-item>

        <el-form-item label="基于职位">
          <el-select v-model="form.jobId" placeholder="不选这个" clearable>
            <el-option
              v-for="j in jobs"
              :key="j.id"
              :label="j.title"
              :value="j.id"
              :disabled="j.parseStatus !== 'SUCCESS'"
            >
              <span>{{ j.title }}</span>
              <span v-if="j.parseStatus !== 'SUCCESS'" class="opt__hint">（未解析）</span>
            </el-option>
          </el-select>
        </el-form-item>
      </div>

      <!--
        ⚠️ 简历和职位【至少要给一个】。
        后端创建时不校验（两个都能空），但【出题】那一步 Python 服务会直接报错：
        「简历和 JD 至少要提供一个，否则出的题和候选人无关」——
        只建得出、出不了题就是死路，所以在这里先挡住。
      -->
      <p class="hint hint--top">
        简历和职位至少选一个 —— AI 将结合您的经历与目标岗位，并自动从
        <strong>全站官方智库</strong> 检索匹配的大厂高频真题与考核标准为您定制考卷。
      </p>

      <el-form-item label="面试类型">
        <el-radio-group v-model="form.interviewType">
          <el-radio-button v-for="t in TYPES" :key="t.value" :value="t.value">
            {{ t.label }}
          </el-radio-button>
        </el-radio-group>
        <p class="hint">{{ TYPES.find((t) => t.value === form.interviewType)?.desc }}</p>
      </el-form-item>

      <el-form-item label="难度">
        <el-radio-group v-model="form.difficulty">
          <el-radio-button v-for="d in DIFFICULTIES" :key="d.value" :value="d.value">
            {{ d.label }}
          </el-radio-button>
        </el-radio-group>
      </el-form-item>

      <el-form-item label="题目数量" prop="questionCount">
        <el-input-number v-model="form.questionCount" :min="1" :max="20" />
        <span class="hint hint--inline">1~20 道，越多越久</span>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="onSubmit">创建</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--mf-space-4);
}

@media (width <= 640px) {
  .row {
    grid-template-columns: 1fr;
  }
}

.opt__hint {
  margin-left: var(--mf-space-2);
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

.hint {
  margin: var(--mf-space-1) 0 0;
  font-size: var(--mf-font-xs);
  line-height: 1.6;
  color: var(--mf-text-tertiary);
}

.hint--top {
  margin: 0 0 var(--mf-space-4);
  padding: var(--mf-space-3);
  font-size: var(--mf-font-xs);
  line-height: 1.6;
  color: var(--mf-text-tertiary);
  background-color: var(--mf-bg-subtle);
  border-radius: var(--mf-radius-sm);
}

.hint--inline {
  margin: 0 0 0 var(--mf-space-3);
}
</style>
