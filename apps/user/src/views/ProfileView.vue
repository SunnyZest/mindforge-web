<script setup lang="ts">
import { Lock } from '@element-plus/icons-vue'
import type { FormInstance, FormRules, UploadRawFile, UploadRequestOptions } from 'element-plus'
import { onMounted, reactive, ref } from 'vue'

import { BizError, type UserProfileVO } from '@mindforge/shared'

import { authApi, profileApi } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import { formatDateTime } from '@/utils/format'

const auth = useAuthStore()

const loading = ref(false)
const profile = ref<UserProfileVO | null>(null)

// ---------- 头像 ----------
const uploadingAvatar = ref(false)

/** 和后端 UploadConstants.AVATAR_EXT / MAX_AVATAR_BYTES 保持一致 */
const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const AVATAR_MAX_BYTES = 2 * 1024 * 1024

/**
 * 上传前先拦一道。
 *
 * ⚠️ 这只是体验层 —— 真正的防线在后端（按**扩展名**判断，不是 MIME）。
 *    前端按 MIME 判断是因为浏览器给的就是它；有人改扩展名绕过来也没用。
 */
function beforeAvatarUpload(file: UploadRawFile): boolean {
  if (!AVATAR_TYPES.includes(file.type)) {
    ElMessage.error('头像只支持 JPG / PNG / WEBP / GIF')
    return false
  }
  if (file.size > AVATAR_MAX_BYTES) {
    ElMessage.error('头像不能超过 2MB')
    return false
  }
  return true
}

/**
 * 自定义上传：不传 action，直接用接口层。
 *
 * ⚠️ 头像上传后**立即生效**（接口会顺手把 avatar_url 写库），不像昵称要点保存 ——
 *    这是刻意的，换头像本来就没有「预览但不确定」的语义。
 */
async function onUploadAvatar(options: UploadRequestOptions): Promise<void> {
  uploadingAvatar.value = true
  try {
    profile.value = await profileApi.uploadAvatar(options.file)
    ElMessage.success('头像已更新')
    // 顶栏 / 其他页面拿的是 auth store 里的用户信息
    await auth.fetchMe()
  } catch (e) {
    fail(e, '头像上传失败')
  } finally {
    uploadingAvatar.value = false
  }
}

// ---------- 资料 ----------
const profileRef = ref<FormInstance>()
const savingProfile = ref(false)
const profileForm = reactive({ nickname: '' })

const profileRules: FormRules<typeof profileForm> = {
  // 长度照抄后端 UserProfileUpdateDTO 的 @Size
  nickname: [{ max: 64, message: '昵称最长 64 字', trigger: 'blur' }],
}

// ---------- 改密码 ----------
const pwdRef = ref<FormInstance>()
const savingPwd = ref(false)
const pwdForm = reactive({ oldPassword: '', newPassword: '', confirm: '' })

const pwdRules: FormRules<typeof pwdForm> = {
  oldPassword: [{ required: true, message: '请输入原密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, max: 64, message: '密码 6~64 位', trigger: 'blur' },
  ],
  confirm: [
    { required: true, message: '请再输入一次新密码', trigger: 'blur' },
    {
      validator: (_rule, value: string, callback) => {
        if (value !== pwdForm.newPassword) callback(new Error('两次输入的新密码不一致'))
        else callback()
      },
      trigger: 'blur',
    },
  ],
}

function fail(e: unknown, fallback: string): void {
  ElMessage.error(e instanceof BizError ? e.message : fallback)
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const data = await profileApi.get()
    profile.value = data
    // 表单填当前值 —— 后端是「传了才改」的语义，所以留空 = 不改
    profileForm.nickname = data.nickname ?? ''
  } catch (e) {
    fail(e, '加载个人资料失败')
  } finally {
    loading.value = false
  }
}

async function onSaveProfile(): Promise<void> {
  const valid = await profileRef.value?.validate().catch(() => false)
  if (!valid) return

  savingProfile.value = true
  try {
    /**
     * ⚠️ 空串要转成 undefined —— 后端是「传了才改」的语义，
     *    直接发空串会真的把昵称清空，而不是「保持不变」。
     *    （这和「清空 = 空数组」是两类约定，别混。）
     *
     * ⚠️ 这里**不再发 avatarUrl**：头像走单独的上传接口，
     *    若把 uploadAvatar 刚写进库的值再覆盖成空串，刚换的头像会立刻消失。
     */
    await profileApi.update({
      nickname: profileForm.nickname.trim() || undefined,
    })
    ElMessage.success('已保存')
    await load()
    // 顶栏显示的是 auth store 里的昵称，改完要重新拉一次才同步
    await auth.fetchMe()
  } catch (e) {
    fail(e, '保存失败')
  } finally {
    savingProfile.value = false
  }
}

async function onChangePassword(): Promise<void> {
  const valid = await pwdRef.value?.validate().catch(() => false)
  if (!valid) return

  savingPwd.value = true
  try {
    await authApi.changePassword({
      oldPassword: pwdForm.oldPassword,
      newPassword: pwdForm.newPassword,
    })
    ElMessage.success('密码已修改，请重新登录')
    pwdForm.oldPassword = pwdForm.newPassword = pwdForm.confirm = ''
    /**
     * 改完密码后端会撤销 refreshToken —— 本地 token 已经没用了。
     * 主动登出比让用户「过一会儿突然被踢」体验好。
     */
    auth.reset()
    location.assign('/login')
  } catch (e) {
    fail(e, '修改密码失败')
  } finally {
    savingPwd.value = false
  }
}

onMounted(load)
</script>

<template>
  <div v-loading="loading" class="profile">
    <el-card class="profile__card">
      <template #header>
        <span class="profile__title">基本信息</span>
      </template>

      <!--
        头像即时生效：点一下选图，传完就落库，不需要再点「保存」。
        ⚠️ <img> 带不上 Authorization 头，所以 `/api/app/avatars/**` 是公开接口 ——
           这是后端唯一一个公开的用户端读接口，安全边界靠「只放行 biz_type=avatars」。
      -->
      <div class="avatar">
        <el-upload
          class="avatar__upload"
          :show-file-list="false"
          :disabled="uploadingAvatar"
          :before-upload="beforeAvatarUpload"
          :http-request="onUploadAvatar"
          accept="image/jpeg,image/png,image/webp,image/gif"
        >
          <div v-loading="uploadingAvatar" class="avatar__box">
            <el-avatar :size="72" :src="profile?.avatarUrl || undefined">
              {{ (profile?.username ?? 'U').slice(0, 1).toUpperCase() }}
            </el-avatar>
          </div>
        </el-upload>
        <div class="avatar__meta">
          <span class="avatar__label">头像</span>
          <span class="avatar__hint">点击更换，支持 JPG / PNG / WEBP / GIF，不超过 2MB</span>
        </div>
      </div>

      <!-- 这些字段后端没有「改」的接口（只有昵称和头像可改），所以只读展示 -->
      <dl class="fields">
        <div class="fields__row">
          <dt>用户名</dt>
          <dd>{{ profile?.username ?? '-' }}</dd>
        </div>
        <div class="fields__row">
          <dt>邮箱</dt>
          <dd>{{ profile?.email ?? '-' }}</dd>
        </div>
        <div class="fields__row">
          <dt>手机号</dt>
          <dd>{{ profile?.phone ?? '-' }}</dd>
        </div>
        <div class="fields__row">
          <dt>注册时间</dt>
          <dd>{{ formatDateTime(profile?.createdAt) }}</dd>
        </div>
      </dl>
    </el-card>

    <el-card class="profile__card">
      <template #header>
        <span class="profile__title">可修改的资料</span>
      </template>

      <el-form ref="profileRef" :model="profileForm" :rules="profileRules" label-position="top">
        <el-form-item label="昵称" prop="nickname">
          <el-input v-model="profileForm.nickname" placeholder="留空则保持不变" maxlength="64" />
        </el-form-item>

        <el-button type="primary" :loading="savingProfile" @click="onSaveProfile"> 保存 </el-button>
      </el-form>
    </el-card>

    <el-card class="profile__card">
      <template #header>
        <span class="profile__title">修改密码</span>
      </template>

      <el-form ref="pwdRef" :model="pwdForm" :rules="pwdRules" label-position="top">
        <el-form-item label="原密码" prop="oldPassword">
          <el-input
            v-model="pwdForm.oldPassword"
            type="password"
            :prefix-icon="Lock"
            show-password
            autocomplete="current-password"
          />
        </el-form-item>

        <el-form-item label="新密码" prop="newPassword">
          <el-input
            v-model="pwdForm.newPassword"
            type="password"
            :prefix-icon="Lock"
            placeholder="6~64 位"
            show-password
            autocomplete="new-password"
          />
        </el-form-item>

        <el-form-item label="确认新密码" prop="confirm">
          <el-input
            v-model="pwdForm.confirm"
            type="password"
            :prefix-icon="Lock"
            show-password
            autocomplete="new-password"
          />
        </el-form-item>

        <p class="profile__hint">改完密码后需要重新登录。</p>

        <el-button type="primary" :loading="savingPwd" @click="onChangePassword">
          修改密码
        </el-button>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped>
.profile {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-5);
  max-width: 640px;
  margin: 0 auto;
}

.profile__title {
  font-weight: var(--mf-weight-medium);
}

/* ---------- 头像 ---------- */
.avatar {
  display: flex;
  align-items: center;
  gap: var(--mf-space-4);
  padding-bottom: var(--mf-space-4);
  margin-bottom: var(--mf-space-2);
  border-bottom: 1px solid var(--mf-border-soft);
}

.avatar__upload {
  flex: none;
}

.avatar__box {
  cursor: pointer;
  border-radius: 50%;
  transition: opacity 0.2s;
}

.avatar__box:hover {
  opacity: 0.85;
}

.avatar__meta {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-1);
}

.avatar__label {
  font-size: var(--mf-font-sm);
  color: var(--mf-text-secondary);
}

.avatar__hint {
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

/* ---------- 只读字段 ---------- */
.fields {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-3);
  margin: 0;
}

.fields__row {
  display: flex;
  gap: var(--mf-space-4);
  font-size: var(--mf-font-sm);
}

.fields__row dt {
  flex: none;
  width: 80px;
  color: var(--mf-text-tertiary);
}

.fields__row dd {
  margin: 0;
  word-break: break-all;
}

.profile__hint {
  margin: 0 0 var(--mf-space-4);
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}
</style>
