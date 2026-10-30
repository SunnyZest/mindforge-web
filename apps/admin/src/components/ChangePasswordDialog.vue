<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus'
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { BizError } from '@mindforge/shared'

import { authApi } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'

/**
 * 管理员修改自身密码。
 *
 * ⚠️ 改完之后后端会撤销当前 refreshToken —— 这个会话已经作废了。
 *    所以成功路径必须是「清本地状态 + 回登录页」，不能让用户继续留在后台：
 *    他下一个请求会 401，刷新也失败，表现为「莫名其妙被踢出去」。
 *
 * 不走二次确认（`X-Confirm-Token`）：这个接口本身就要求传原密码，
 * 再让用户输一遍密码换凭证，等于同一个操作输两次密码。
 */

const visible = defineModel<boolean>({ required: true })

const router = useRouter()
const auth = useAuthStore()

const formRef = ref<FormInstance>()
const saving = ref(false)

const form = reactive({
  oldPassword: '',
  newPassword: '',
  confirm: '',
})

const rules: FormRules<typeof form> = {
  oldPassword: [{ required: true, message: '请输入原密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, max: 64, message: '新密码长度需在 6-64 之间', trigger: 'blur' },
    {
      // 后端不拦「新旧相同」，但那样改了等于没改，用户还会以为生效了
      validator: (_r, v: string, cb) =>
        v && v === form.oldPassword ? cb(new Error('新密码不能与原密码相同')) : cb(),
      trigger: 'blur',
    },
  ],
  confirm: [
    { required: true, message: '请再输入一次新密码', trigger: 'blur' },
    {
      validator: (_r, v: string, cb) =>
        v !== form.newPassword ? cb(new Error('两次输入的新密码不一致')) : cb(),
      trigger: 'blur',
    },
  ],
}

function reset(): void {
  form.oldPassword = form.newPassword = form.confirm = ''
  formRef.value?.clearValidate()
}

async function submit(): Promise<void> {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  try {
    await authApi.changePassword({
      oldPassword: form.oldPassword,
      newPassword: form.newPassword,
    })
    // 先提示再跳，顺序反了用户看不到这句话
    ElMessage.success('密码已修改，请用新密码重新登录')
    visible.value = false
    reset()
    auth.reset()
    await router.replace({ name: 'login' })
  } catch (e) {
    ElMessage.error(e instanceof BizError ? e.message : '修改密码失败，请稍后重试')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    title="修改密码"
    width="min(420px, 92vw)"
    :close-on-click-modal="false"
    append-to-body
    @closed="reset"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="88px">
      <el-form-item label="原密码" prop="oldPassword">
        <el-input v-model="form.oldPassword" type="password" show-password autocomplete="off" />
      </el-form-item>

      <el-form-item label="新密码" prop="newPassword">
        <el-input
          v-model="form.newPassword"
          type="password"
          show-password
          autocomplete="new-password"
        />
      </el-form-item>

      <el-form-item label="确认新密码" prop="confirm">
        <el-input
          v-model="form.confirm"
          type="password"
          show-password
          autocomplete="new-password"
          @keyup.enter="submit"
        />
      </el-form-item>

      <p class="tip">改完密码后本次登录会失效，需要用新密码重新登录。</p>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">确认修改</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.tip {
  margin: 0;
  font-size: var(--mf-font-xs);
  line-height: 1.6;
  color: var(--mf-text-tertiary);
}
</style>
