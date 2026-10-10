<script setup lang="ts">
import zhCn from 'element-plus/es/locale/lang/zh-cn'
</script>

<template>
  <!--
    Element Plus 的语言包。不配的话组件走英文默认值：
    MessageBox 的按钮是 Cancel / OK，分页是 Total 2。
    ⚠️ 用 el-config-provider 而不是 app.use(ElementPlus, { locale }) ——
       后者会把整个库打进产物（按需引入就废了）。
  -->
  <el-config-provider :locale="zhCn">
    <router-view />
  </el-config-provider>
</template>
