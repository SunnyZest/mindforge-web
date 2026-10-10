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

// 从注册页跳过来时会带上 ?username=xxx —— 帮他填好，省得再打一遍。
// ⚠️ 只取字符串：query 的值可能是数组（?username=a&username=b），
//    直接赋给 v-model 会让 el-input 拿到数组，输入框显示成空白。
const fromRegister = route.query.username
if (typeof fromRegister === 'string') form.username = fromRegister

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
    await router.replace(typeof redirect === 'string' ? redirect : { name: 'workspace' })
  } catch (e) {
    // BizError 里装的是后端原话（「用户名或密码错误」），直接给用户看
    ElMessage.error(e instanceof BizError ? e.message : '登录失败，请稍后重试')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth">
    <el-card class="auth__card">
      <div class="auth__brand">
        <span class="auth__logo">M</span>
      </div>
      <h1 class="auth__title">欢迎回来</h1>
      <p class="auth__subtitle">登录 MindForge AI，继续你的求职准备</p>

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
          class="auth__submit"
          native-type="submit"
          :loading="loading"
          :disabled="loading"
        >
          登录
        </el-button>
      </el-form>

      <p class="auth__foot">
        还没有账号？
        <router-link class="auth__link" :to="{ name: 'register' }">注册一个</router-link>
      </p>
    </el-card>
  </div>
</template>

<style scoped>
.auth {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: var(--mf-space-6);
}

.auth__card {
  width: 380px;
  max-width: 100%;
}

.auth__brand {
  display: flex;
  justify-content: center;
  margin-bottom: var(--mf-space-4);
}

/* 和顶栏 logo / favicon 同一套视觉 */
.auth__logo {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  font-size: 26px;
  font-weight: var(--mf-weight-medium);
  color: #fff;
  background: linear-gradient(160deg, #4a9eff, #0071e3);
  border-radius: var(--mf-radius-lg);
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
