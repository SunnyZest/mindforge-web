<script setup lang="ts">
import { Lock, Message } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { BizError } from '@mindforge/shared'

import { authApi } from '@/api/auth'
import { useCodeCountdown } from '@/composables/useCodeCountdown'

const router = useRouter()

const formRef = ref<FormInstance>()
const loading = ref(false)
const sending = ref(false)

const { remaining, counting, start } = useCodeCountdown()

const form = reactive({ email: '', code: '', newPassword: '', confirm: '' })

const rules: FormRules<typeof form> = {
  email: [
    { required: true, message: '请输入注册邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: 'blur' },
  ],
  code: [
    { required: true, message: '请输入邮箱验证码', trigger: 'blur' },
    { len: 6, message: '验证码是 6 位数字', trigger: 'blur' },
  ],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, max: 64, message: '密码 6~64 位', trigger: 'blur' },
  ],
  confirm: [
    { required: true, message: '请再输入一次新密码', trigger: 'blur' },
    {
      validator: (_rule, value: string, callback) => {
        if (value !== form.newPassword) callback(new Error('两次输入的新密码不一致'))
        else callback()
      },
      trigger: 'blur',
    },
  ],
}

async function onSendCode(): Promise<void> {
  if (sending.value || counting.value) return

  const emailOk = await formRef.value
    ?.validateField('email')
    .then(() => true)
    .catch(() => false)
  if (!emailOk) return

  sending.value = true
  try {
    await authApi.sendVerificationCode({
      channel: 'EMAIL',
      target: form.email.trim(),
      scene: 'RESET_PASSWORD',
    })
    start()
    // ⚠️ 不管邮箱有没有注册过都提示「已发送」—— 后端刻意不区分，
    //    这里要是说「该邮箱未注册」，等于把探测能力又还给了前端。
    ElMessage.success('如果该邮箱已注册，验证码会在一分钟内送达（记得看垃圾箱）')
  } catch (e) {
    ElMessage.error(e instanceof BizError ? e.message : '发送失败，请稍后重试')
  } finally {
    sending.value = false
  }
}

async function onSubmit(): Promise<void> {
  if (loading.value) return
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  try {
    await authApi.resetPassword({
      email: form.email.trim(),
      code: form.code.trim(),
      newPassword: form.newPassword,
    })

    // 后端会撤销该用户的全部 refreshToken，所以旧会话已经登不回去了
    ElMessage.success('密码已重置，请用新密码登录')
    await router.replace({ name: 'login' })
  } catch (e) {
    ElMessage.error(e instanceof BizError ? e.message : '重置失败，请稍后重试')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth">
    <el-card class="auth__card">
      <h1 class="auth__title">找回密码</h1>
      <p class="auth__subtitle">用注册邮箱接收验证码，验证后设置新密码</p>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @submit.prevent="onSubmit"
      >
        <el-form-item label="注册邮箱" prop="email">
          <el-input
            v-model="form.email"
            :prefix-icon="Message"
            placeholder="注册时填的邮箱"
            autocomplete="email"
          />
        </el-form-item>

        <el-form-item label="邮箱验证码" prop="code">
          <div class="auth__code-row">
            <el-input
              v-model="form.code"
              placeholder="6 位数字"
              maxlength="6"
              autocomplete="one-time-code"
            />
            <el-button
              class="auth__code-btn"
              :loading="sending"
              :disabled="counting || sending"
              @click="onSendCode"
            >
              {{ counting ? `${remaining} 秒后重发` : '获取验证码' }}
            </el-button>
          </div>
        </el-form-item>

        <el-form-item label="新密码" prop="newPassword">
          <el-input
            v-model="form.newPassword"
            type="password"
            :prefix-icon="Lock"
            placeholder="6~64 位"
            show-password
            autocomplete="new-password"
          />
        </el-form-item>

        <el-form-item label="确认新密码" prop="confirm">
          <el-input
            v-model="form.confirm"
            type="password"
            :prefix-icon="Lock"
            placeholder="再输入一次"
            show-password
            autocomplete="new-password"
          />
        </el-form-item>

        <el-button
          type="primary"
          class="auth__submit"
          native-type="submit"
          :loading="loading"
          :disabled="loading"
        >
          重置密码
        </el-button>
      </el-form>

      <p class="auth__foot">
        想起密码了？
        <router-link class="auth__link" :to="{ name: 'login' }">回登录</router-link>
      </p>
    </el-card>
  </div>
</template>

<style scoped>
.auth {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100%;
  padding: var(--mf-space-6);
}

.auth__card {
  width: 380px;
  max-width: 100%;
}

.auth__title {
  margin: 0 0 var(--mf-space-1);
  font-size: var(--mf-font-xl);
  font-weight: var(--mf-weight-medium);
  text-align: center;
  letter-spacing: -0.02em;
}

.auth__subtitle {
  margin: 0 0 var(--mf-space-6);
  font-size: var(--mf-font-sm);
  color: var(--mf-text-tertiary);
  text-align: center;
}

.auth__code-row {
  display: flex;
  gap: var(--mf-space-2);
  width: 100%;
}

.auth__code-btn {
  flex: none;
  min-width: 108px;
}

.auth__submit {
  width: 100%;
}

.auth__foot {
  margin: var(--mf-space-4) 0 0;
  font-size: var(--mf-font-sm);
  color: var(--mf-text-tertiary);
  text-align: center;
}

.auth__link {
  color: var(--mf-primary-text);
  text-decoration: none;
}

.auth__link:hover {
  text-decoration: underline;
}
</style>
