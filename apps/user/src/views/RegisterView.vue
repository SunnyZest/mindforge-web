<script setup lang="ts">
import { Lock, Message, User } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { BizError } from '@mindforge/shared'

import { authApi } from '@/api/auth'

const router = useRouter()

const formRef = ref<FormInstance>()
const loading = ref(false)

const form = reactive({ username: '', email: '', password: '', confirm: '' })

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
  email: [{ type: 'email', message: '邮箱格式不正确', trigger: 'blur' }],
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

async function onSubmit(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  try {
    await authApi.register({
      username: form.username,
      // 邮箱可空 —— 后端 required 里没有它。空串要转成 undefined，
      // 否则会带着一个空字符串发过去（后端可能当成「改了邮箱」）
      email: form.email.trim() || undefined,
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

        <el-form-item label="邮箱（可选）" prop="email">
          <el-input
            v-model="form.email"
            :prefix-icon="Message"
            placeholder="用于找回账号"
            autocomplete="email"
          />
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
            @keyup.enter="onSubmit"
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
