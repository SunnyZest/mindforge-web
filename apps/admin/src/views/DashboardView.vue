<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
</script>

<template>
  <el-card shadow="never">
    <h2 class="title">你好，{{ auth.user?.nickname || auth.user?.username }}</h2>

    <el-descriptions :column="1" border class="info">
      <el-descriptions-item label="用户 ID">{{ auth.user?.id }}</el-descriptions-item>
      <el-descriptions-item label="角色">
        <el-tag v-for="r in auth.user?.roles" :key="r" size="small" class="tag">{{ r }}</el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="权限数">
        {{ auth.permissions.length }} 项
      </el-descriptions-item>
    </el-descriptions>

    <p class="hint">
      这个页面是脚手架的一部分 —— 它证明「登录 → 拿 token → 带 token 请求 → 拆信封」
      这条链路是通的。真正的 Dashboard 统计接口在
      <code>GET /api/admin/dashboard</code>，还没接。
    </p>
  </el-card>
</template>

<style scoped>
.title {
  margin: 0 0 var(--mf-space-4);
  font-size: var(--mf-font-lg);
  font-weight: var(--mf-weight-medium);
}

.info {
  max-width: 520px;
}

.tag {
  margin-right: var(--mf-space-1);
}

.hint {
  margin: var(--mf-space-6) 0 0;
  font-size: var(--mf-font-sm);
  line-height: var(--mf-leading);
  color: var(--mf-text-tertiary);
}

code {
  padding: 1px var(--mf-space-1);
  font-size: var(--mf-font-xs);
  background-color: var(--mf-bg-subtle);
  border-radius: var(--mf-radius-sm);
}
</style>
