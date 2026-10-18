<script setup lang="ts">
import { Lock, Message, User } from '@element-plus/icons-vue'
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

/** 60 秒倒计时：和后端冷却保持一致，见 useCodeCountdown 的说明 */
const { remaining, counting, start } = useCodeCountdown()

const form = reactive({ username: '', email: '', code: '', password: '', confirm: '' })

/**
 * ⚠️ 长度约束照抄后端 `RegisterDTO` 上的 `@Size`（username 3~32、password 6~64）。
 *    前端这层只是**提前拦一下、把话说清楚**，后端那层才是真校验 ——
 *    别把这里当安全边界。
 */
const rules: FormRules<typeof form> = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 32, message: '用户名 3~32 位', trigger: 'blur' },
  ],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: 'blur' },
  ],
  code: [
    { required: true, message: '请输入邮箱验证码', trigger: 'blur' },
    { len: 6, message: '验证码是 6 位数字', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 64, message: '密码 6~64 位', trigger: 'blur' },
  ],
  confirm: [
    { required: true, message: '请再输入一次密码', trigger: 'blur' },
    {
      // ⚠️ 用自定义校验而不是 `validator` 里手写 —— 这样能拿到 form 的当前值，
      //    而不是把两次输入分别写死在校验闭包里（后者改了字段名容易漏改）
      validator: (_rule, value: string, callback) => {
        if (value !== form.password) callback(new Error('两次输入的密码不一致'))
        else callback()
      },
      trigger: 'blur',
    },
  ],
}

/**
 * 发验证码。
 *
 * 只校验邮箱这一项 —— 用户名/密码还没填完也允许先收码，
 * 否则用户得先填完整个表单才能拿码，来回折腾。
 */
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
      scene: 'REGISTER',
    })
    start()
    ElMessage.success('验证码已发送，请查收邮箱（没收到就看下垃圾箱）')
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
    await authApi.register({
      username: form.username,
      email: form.email.trim(),
      code: form.code.trim(),
      password: form.password,
    })

    // 后端注册完【不会】自动登录，所以要跳回登录页让用户登一次。
    // 把用户名带上，省得他再打一遍。
    ElMessage.success('注册成功，请登录')
    await router.replace({ name: 'login', query: { username: form.username } })
  } catch (e) {
    ElMessage.error(e instanceof BizError ? e.message : '注册失败，请稍后重试')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth">
    <el-card class="auth__card">
      <h1 class="auth__title">创建账号</h1>
      <p class="auth__subtitle">开始用 AI 打磨你的简历和面试</p>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @submit.prevent="onSubmit"
      >
        <el-form-item label="用户名" prop="username">
          <el-input
            v-model="form.username"
            :prefix-icon="User"
            placeholder="3~32 位"
            autocomplete="username"
          />
        </el-form-item>

        <el-form-item label="邮箱" prop="email">
          <el-input
            v-model="form.email"
            :prefix-icon="Message"
            placeholder="需要接收验证码"
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

        <el-form-item label="密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            :prefix-icon="Lock"
            placeholder="6~64 位"
            show-password
            autocomplete="new-password"
          />
        </el-form-item>

        <el-form-item label="确认密码" prop="confirm">
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
          注册
        </el-button>
      </el-form>

      <p class="auth__foot">
        已经有账号了？
        <router-link class="auth__link" :to="{ name: 'login' }">去登录</router-link>
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
