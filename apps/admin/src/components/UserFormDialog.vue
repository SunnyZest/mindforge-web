<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus'
import { computed, reactive, ref, watch } from 'vue'

import type { AdminUserCreateDTO, RoleVO, UserSummaryVO, UserUpdateDTO } from '@mindforge/shared'
import { BizError } from '@mindforge/shared'

import { userApi } from '@/api/user'

/** 弹窗开关（`v-model`） */
const visible = defineModel<boolean>({ required: true })

const props = defineProps<{
  /** `null` = 新增；有值 = 编辑这个用户 */
  user: UserSummaryVO | null
  /** 角色下拉的选项 —— 新增用户时要选角色 */
  roles: RoleVO[]
}>()

const emit = defineEmits<{ saved: [] }>()

const isEdit = computed(() => props.user !== null)

const formRef = ref<FormInstance>()
const saving = ref(false)

const form = reactive({
  username: '',
  password: '',
  nickname: '',
  email: '',
  phone: '',
  roleIds: [] as number[],
})

/**
 * 校验规则随「新增 / 编辑」切换。
 *
 * ⚠️ 编辑时 username 和 password **不参与校验也不提交** ——
 * `UserUpdateDTO` 里根本没有这两个字段（后端不允许改用户名，
 * 改密码走的是另一个接口）。如果这里还校验，用户编辑个昵称会被
 * 「请输入用户名」拦住。
 */
const rules = computed<FormRules<typeof form>>(() => ({
  username: isEdit.value
    ? []
    : [
        { required: true, message: '请输入用户名', trigger: 'blur' },
        { min: 3, max: 20, message: '长度 3~20 位', trigger: 'blur' },
      ],
  password: isEdit.value
    ? []
    : [
        { required: true, message: '请输入初始密码', trigger: 'blur' },
        { min: 6, max: 32, message: '长度 6~32 位', trigger: 'blur' },
      ],
  email: [{ type: 'email', message: '邮箱格式不正确', trigger: 'blur' }],
}))

// 每次打开时回填 —— 不这么做的话，上次编辑的残留会带进下一次
watch(visible, (open) => {
  if (!open) return
  formRef.value?.clearValidate()

  const u = props.user
  form.username = u?.username ?? ''
  form.nickname = u?.nickname ?? ''
  form.email = u?.email ?? ''
  form.phone = u?.phone ?? ''
  form.password = ''
  form.roleIds = []
})

async function submit(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  try {
    if (props.user) {
      // 空串转 undefined：把「没填」和「填了空」区分开，后者会把已有值清掉
      const dto: UserUpdateDTO = {
        nickname: form.nickname.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
      }
      await userApi.update(props.user.id, dto)
      ElMessage.success('已保存')
    } else {
      const dto: AdminUserCreateDTO = {
        username: form.username.trim(),
        password: form.password,
        nickname: form.nickname.trim() || undefined,
        email: form.email.trim() || undefined,
        // ⚠️ RoleVO.id 是 string，但这个 DTO 要 number[] —— 必须转
        roleIds: form.roleIds.length ? form.roleIds : undefined,
      }
      await userApi.create(dto)
      ElMessage.success('已创建')
    }
    visible.value = false
    emit('saved')
  } catch (e) {
    ElMessage.error(e instanceof BizError ? e.message : '保存失败')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="isEdit ? '编辑用户' : '新增用户'"
    width="480px"
    :close-on-click-modal="false"
    append-to-body
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
      <el-form-item label="用户名" prop="username">
        <el-input
          v-model="form.username"
          :disabled="isEdit"
          placeholder="登录用的账号，创建后不可改"
        />
      </el-form-item>

      <el-form-item v-if="!isEdit" label="初始密码" prop="password">
        <el-input v-model="form.password" type="password" show-password placeholder="6~32 位" />
      </el-form-item>

      <el-form-item label="昵称" prop="nickname">
        <el-input v-model="form.nickname" placeholder="不填则与用户名相同" />
      </el-form-item>

      <el-form-item label="邮箱" prop="email">
        <el-input v-model="form.email" placeholder="选填" />
      </el-form-item>

      <el-form-item label="手机号" prop="phone">
        <el-input v-model="form.phone" placeholder="选填" />
      </el-form-item>

      <el-form-item v-if="!isEdit" label="角色">
        <el-select v-model="form.roleIds" multiple placeholder="不选则只给默认角色 USER" style="width: 100%">
          <el-option
            v-for="r in roles"
            :key="r.id"
            :label="r.name"
            :value="Number(r.id)"
            :disabled="r.status !== 1"
          />
        </el-select>
      </el-form-item>

      <p v-if="isEdit" class="tip">
        要改这个用户的角色，请用列表里的「分配角色」。
      </p>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.tip {
  margin: 0;
  padding-left: 80px;
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}
</style>
