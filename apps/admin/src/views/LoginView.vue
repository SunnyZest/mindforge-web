<script setup lang="ts">
import { Lock, User } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { BizError } from '@mindforge/shared'

import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const formRef = ref<FormInstance>()
const loading = ref(false)

const form = reactive({ username: '', password: '' })

const rules: FormRules<typeof form> = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

async function onSubmit(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  try {
    await auth.login({ username: form.username, password: form.password })

    // 被守卫拦下来的话 query 里带着原目标，登录后送回去
    const redirect = route.query.redirect
    await router.replace(typeof redirect === 'string' ? redirect : { name: 'dashboard' })
  } catch (e) {
    // BizError 里装的是后端原话（「用户名或密码错误」），直接给用户看
    ElMessage.error(e instanceof BizError ? e.message : '登录失败，请稍后重试')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login">
    <el-card class="login__card">
      <h1 class="login__title">MindForge 管理后台</h1>
      <p class="login__subtitle">请使用管理员账号登录</p>

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
            placeholder="用户名"
            autocomplete="username"
          />
        </el-form-item>

        <el-form-item label="密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            :prefix-icon="Lock"
            placeholder="密码"
            show-password
            autocomplete="current-password"
            @keyup.enter="onSubmit"
          />
        </el-form-item>

        <el-button
          type="primary"
          class="login__submit"
          native-type="submit"
          :loading="loading"
          :disabled="loading"
        >
          登录
        </el-button>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped>
.login {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.login__card {
  width: 380px;
}

.login__title {
  margin: 0 0 var(--mf-space-1);
  font-size: var(--mf-font-lg);
  font-weight: var(--mf-weight-medium);
  text-align: center;
}

.login__subtitle {
  margin: 0 0 var(--mf-space-6);
  font-size: var(--mf-font-sm);
  color: var(--mf-text-tertiary);
  text-align: center;
}

.login__submit {
  width: 100%;
}
</style>
