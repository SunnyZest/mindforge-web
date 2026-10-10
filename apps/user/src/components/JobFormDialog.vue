<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus'
import { reactive, ref, watch } from 'vue'

import { BizError, type JobDetailVO, type JobVO } from '@mindforge/shared'

import { jobApi } from '@/api/job'

const visible = defineModel<boolean>({ required: true })

const props = defineProps<{
  /** null = 新增；有值 = 编辑 */
  job: JobVO | null
}>()

const emit = defineEmits<{ saved: [] }>()

const formRef = ref<FormInstance>()
const saving = ref(false)
const loading = ref(false)

const form = reactive({
  title: '',
  companyName: '',
  location: '',
  sourceUrl: '',
  experienceRequired: '',
  educationRequired: '',
  jobDescription: '',
})

const isEdit = ref(false)

/**
 * 校验规则 —— 长度上限照抄后端的 @Size。
 * ⚠️ 前端这层只是提前拦一下、把话说清楚，后端才是真校验。
 */
const rules: FormRules<typeof form> = {
  title: [
    { required: true, message: '请输入职位名称', trigger: 'blur' },
    { max: 255, message: '最长 255 个字符', trigger: 'blur' },
  ],
  companyName: [{ max: 255, message: '最长 255 个字符', trigger: 'blur' }],
  location: [{ max: 255, message: '最长 255 个字符', trigger: 'blur' }],
  sourceUrl: [{ max: 1000, message: '最长 1000 个字符', trigger: 'blur' }],
  experienceRequired: [{ max: 128, message: '最长 128 个字符', trigger: 'blur' }],
  educationRequired: [{ max: 128, message: '最长 128 个字符', trigger: 'blur' }],
  jobDescription: [{ required: true, message: '请粘贴 JD 正文', trigger: 'blur' }],
}

function reset(): void {
  form.title = ''
  form.companyName = ''
  form.location = ''
  form.sourceUrl = ''
  form.experienceRequired = ''
  form.educationRequired = ''
  form.jobDescription = ''
  formRef.value?.clearValidate()
}

/**
 * 打开时决定「新增」还是「编辑」。
 *
 * ⚠️ 编辑要**多拉一次详情** —— 列表的 JobVO 里没有 jobDescription
 *    （那是 JD 正文，响应体太大不适合放列表），不拉的话编辑框会是空的，
 *    用户一保存就把正文清掉了。这是个很容易漏的坑。
 */
watch(visible, async (open) => {
  if (!open) return
  isEdit.value = props.job !== null
  reset()

  if (!props.job) return

  loading.value = true
  try {
    const d: JobDetailVO = await jobApi.detail(props.job.id)
    form.title = d.title
    form.companyName = d.companyName ?? ''
    form.location = d.location ?? ''
    form.sourceUrl = d.sourceUrl ?? ''
    form.experienceRequired = d.experienceRequired ?? ''
    form.educationRequired = d.educationRequired ?? ''
    form.jobDescription = d.rawContent ?? ''
  } catch (e) {
    ElMessage.error(e instanceof BizError ? e.message : '加载职位详情失败')
    visible.value = false
  } finally {
    loading.value = false
  }
})

async function onSubmit(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  try {
    // ⚠️ 可空字段的空串要转 undefined：后端是「传了才改」的语义，
    //    直接发空串会真的把公司名/地点清空，而不是「保持不变」。
    const base = {
      title: form.title.trim(),
      companyName: form.companyName.trim() || undefined,
      location: form.location.trim() || undefined,
      sourceUrl: form.sourceUrl.trim() || undefined,
      experienceRequired: form.experienceRequired.trim() || undefined,
      educationRequired: form.educationRequired.trim() || undefined,
      jobDescription: form.jobDescription,
    }

    if (isEdit.value && props.job) {
      await jobApi.update(props.job.id, base)
    } else {
      await jobApi.create(base)
    }

    ElMessage.success(isEdit.value ? '已保存' : '已添加，接着点「解析」让 AI 读出要求')
    emit('saved')
    visible.value = false
  } catch (e) {
    ElMessage.error(e instanceof BizError ? e.message : '保存失败')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <!-- ⚠️ append-to-body 不能少 —— 弹窗写在卡片里，卡片有 backdrop-filter + overflow:hidden，
       不加的话 position:fixed 的遮罩会变成相对卡片定位，然后被裁掉。 -->
  <el-dialog
    v-model="visible"
    :title="isEdit ? '编辑职位' : '添加职位'"
    width="720px"
    append-to-body
    destroy-on-close
  >
    <el-form
      ref="formRef"
      v-loading="loading"
      :model="form"
      :rules="rules"
      label-position="top"
      @submit.prevent="onSubmit"
    >
      <el-form-item label="职位名称" prop="title">
        <el-input v-model="form.title" placeholder="如：Java 后端开发工程师" maxlength="255" />
      </el-form-item>

      <div class="row">
        <el-form-item label="公司" prop="companyName">
          <el-input v-model="form.companyName" placeholder="可空" maxlength="255" />
        </el-form-item>
        <el-form-item label="工作地点" prop="location">
          <el-input v-model="form.location" placeholder="可空" maxlength="255" />
        </el-form-item>
      </div>

      <div class="row">
        <el-form-item label="经验要求" prop="experienceRequired">
          <el-input v-model="form.experienceRequired" placeholder="如：3-5 年" maxlength="128" />
        </el-form-item>
        <el-form-item label="学历要求" prop="educationRequired">
          <el-input v-model="form.educationRequired" placeholder="如：本科及以上" maxlength="128" />
        </el-form-item>
      </div>

      <el-form-item label="来源链接" prop="sourceUrl">
        <el-input v-model="form.sourceUrl" placeholder="可空" maxlength="1000" />
      </el-form-item>

      <el-form-item label="JD 正文" prop="jobDescription">
        <el-input
          v-model="form.jobDescription"
          type="textarea"
          :rows="10"
          placeholder="把招聘网站上的职位描述整段粘进来 —— 职责、要求、福利都留着，AI 解析时用得上"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="onSubmit">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
/* 一行两个字段 —— 公司/地点、经验/学历 都是短字段，各占一行太浪费纵向空间 */
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
</style>
