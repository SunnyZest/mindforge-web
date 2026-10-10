<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus'
import { reactive, ref, watch } from 'vue'

import { BizError, type KnowledgeBaseVO } from '@mindforge/shared'

import { knowledgeApi } from '@/api/knowledge'

const visible = defineModel<boolean>({ required: true })
const props = defineProps<{ kb: KnowledgeBaseVO | null }>()
const emit = defineEmits<{ saved: [] }>()

const formRef = ref<FormInstance>()
const saving = ref(false)
const isEdit = ref(false)

const form = reactive({ name: '', description: '' })

/** 长度上限照抄后端的 @Size */
const rules: FormRules<typeof form> = {
  name: [
    { required: true, message: '请输入知识库名称', trigger: 'blur' },
    { max: 100, message: '最长 100 个字符', trigger: 'blur' },
  ],
  description: [{ max: 500, message: '最长 500 个字符', trigger: 'blur' }],
}

function reset(): void {
  form.name = props.kb?.name ?? ''
  form.description = props.kb?.description ?? ''
  formRef.value?.clearValidate()
}

/**
 * 打开时按 props.kb 填好表单。
 * ⚠️ 必须监听 visible：`destroy-on-close` 只销毁 el-form 实例，
 *    上面那个 reactive 的 form 是本组件的、会留着 ——
 *    不清的话第二次打开会看到上一次的内容。
 */
watch(visible, (open) => {
  if (!open) return
  isEdit.value = props.kb !== null
  reset()
})

async function onSubmit(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  try {
    // ⚠️ 空串转 undefined —— 后端是「传了才改」的语义，
    //    发空串会真的把描述清掉（这里其实想清掉也说得通，
    //    但「没填」和「要清空」是两回事，让用户用输入框删干净来表达后者）。
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
    }

    if (isEdit.value && props.kb) {
      await knowledgeApi.update(props.kb.id, payload)
    } else {
      await knowledgeApi.create(payload)
    }
    ElMessage.success(isEdit.value ? '已保存' : '已创建，接着上传文档')
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
  <!-- ⚠️ append-to-body：卡片有 backdrop-filter + overflow:hidden，不加会被裁 -->
  <el-dialog
    v-model="visible"
    :title="isEdit ? '编辑知识库' : '新建知识库'"
    width="520px"
    append-to-body
    destroy-on-close
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
      @submit.prevent="onSubmit"
    >
      <el-form-item label="名称" prop="name">
        <el-input v-model="form.name" placeholder="如：Java 面试八股" maxlength="100" />
      </el-form-item>

      <el-form-item label="描述" prop="description">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="3"
          placeholder="可空 —— 写一句这个库装什么，以后好找"
          maxlength="500"
          show-word-limit
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="onSubmit">保存</el-button>
    </template>
  </el-dialog>
</template>
