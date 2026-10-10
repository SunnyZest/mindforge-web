<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

/**
 * 「建设中」占位页。
 *
 * ★ 为什么做一个统一的占位页，而不是在菜单里直接禁用这些项：
 *   禁用的项用户分不清是「没做」还是「我没权限」—— 两种情况的下一步动作完全不同
 *   （等更新 vs 找管理员开权限）。点进来看到一句明确的说明，比灰着强。
 *
 * 标题从路由 meta 里取，所以新增占位页不用改这个文件。
 */
const title = (route.meta.title as string | undefined) ?? '该功能'
</script>

<template>
  <div class="soon">
    <el-card class="soon__card">
      <h2 class="soon__title">{{ title }}正在建设中</h2>
      <p class="soon__text">
        后端接口已经就绪，前端页面还没做。这一页先占个位置，免得你在菜单里点进来是空白。
      </p>
      <el-button type="primary" @click="router.replace({ name: 'workspace' })">
        回工作台
      </el-button>
    </el-card>
  </div>
</template>

<style scoped>
.soon {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
}

.soon__card {
  max-width: 460px;
  text-align: center;
}

.soon__title {
  margin: 0 0 var(--mf-space-3);
  font-size: var(--mf-font-lg);
  font-weight: var(--mf-weight-medium);
}

.soon__text {
  margin: 0 0 var(--mf-space-5);
  font-size: var(--mf-font-sm);
  line-height: 1.7;
  color: var(--mf-text-tertiary);
}
</style>
