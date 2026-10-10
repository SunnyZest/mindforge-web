<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <el-result icon="warning" title="403" sub-title="你没有访问这个页面的权限">
    <template #extra>
      <el-button type="primary" @click="router.replace({ name: 'workspace' })">
        回到工作台
      </el-button>
    </template>
  </el-result>
</template>
