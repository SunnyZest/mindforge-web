<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus'
import { computed, reactive, ref, watch } from 'vue'

import type { RoleCreateDTO, RoleUpdateDTO, RoleVO } from '@mindforge/shared'
import { BizError } from '@mindforge/shared'

import { roleApi } from '@/api/role'

const visible = defineModel<boolean>({ required: true })

const props = defineProps<{
  /** `null` = 新增；有值 = 编辑该角色 */
  role: RoleVO | null
}>()

const emit = defineEmits<{ saved: [] }>()

const isEdit = computed(() => props.role !== null)

const formRef = ref<FormInstance>()
const saving = ref(false)

const form = reactive({
  name: '',
  code: '',
  description: '',
  status: 1,
})

const rules = computed<FormRules<typeof form>>(() => ({
  name: [{ required: true, message: '请输入角色名称', trigger: 'blur' }],
  /**
   * ⚠️ `code` 只在新增时校验：
   *    `RoleUpdateDTO` 里根本没有 code 字段 —— 角色 code 创建后不可改
   *    （它是权限判断的依据，改了会让所有引用它的地方失效）。
   */
  code: isEdit.value
    ? []
    : [
        { required: true, message: '请输入角色 code', trigger: 'blur' },
        {
          // 和后端 `RoleCreateDTO` 的校验规则保持一致：
          // 仅大写字母 / 数字 / 下划线，且以大写字母开头
          pattern: /^[A-Z][A-Z0-9_]*$/,
          message: '只能是大写字母、数字、下划线，且以字母开头',
          trigger: 'blur',
        },
      ],
}))

watch(visible, (open) => {
  if (!open) return
  formRef.value?.clearValidate()

  const r = props.role
  form.name = r?.name ?? ''
  form.code = r?.code ?? ''
  form.description = r?.description ?? ''
  form.status = r?.status ?? 1
})

async function submit(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  /**
   * ⚠️ 「把角色从启用改成禁用」是破坏性操作 ——
   * 绑定这个角色的用户会立刻失去它的全部权限。
   * 确认放在 saving 之前：用户点取消时不该闪一下「保存中」。
   */
  if (props.role && props.role.status === 1 && form.status === 0) {
    const ok = await ElMessageBox.confirm(
      `禁用「${props.role.name}」后，绑定该角色的用户会立刻失去它的全部权限，确定吗？`,
      '确认禁用角色',
      { type: 'warning', confirmButtonText: '禁用' },
    ).catch(() => false)
    if (!ok) return
  }

  saving.value = true
  try {
    if (props.role) {
      const dto: RoleUpdateDTO = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        status: form.status,
      }
      await roleApi.update(props.role.id, dto)
      ElMessage.success('已保存')
    } else {
      const dto: RoleCreateDTO = {
        name: form.name.trim(),
        code: form.code.trim(),
        description: form.description.trim() || undefined,
      }
      await roleApi.create(dto)
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
    :title="isEdit ? '编辑角色' : '新增角色'"
    width="min(460px, 92vw)"
    :close-on-click-modal="false"
    append-to-body
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
      <el-form-item label="名称" prop="name">
        <el-input v-model="form.name" placeholder="给人看的名字，如「内容运营」" />
      </el-form-item>

      <el-form-item label="Code" prop="code">
        <el-input
          v-model="form.code"
          :disabled="isEdit"
          placeholder="如 CONTENT_OPS，创建后不可改"
        />
      </el-form-item>

      <el-form-item label="描述" prop="description">
        <el-input v-model="form.description" type="textarea" :rows="2" placeholder="选填" />
      </el-form-item>

      <el-form-item v-if="isEdit" label="状态" prop="status">
        <el-radio-group v-model="form.status">
          <el-radio :value="1">启用</el-radio>
          <el-radio :value="0">禁用</el-radio>
        </el-radio-group>
      </el-form-item>

      <p v-if="isEdit" class="tip">角色 code 创建后不可修改 —— 权限判断依赖它。</p>
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
