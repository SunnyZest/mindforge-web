<script setup lang="ts">
import zhCn from 'element-plus/es/locale/lang/zh-cn'
</script>

<template>
  <!--
    ★ Element Plus 的语言包 —— 不配的话组件会走英文默认值：
      MessageBox 的按钮是 "Cancel" / "OK"，分页是 "Total 2" / "10/page"。
      界面全是中文、只有这些控件是英文，很扎眼。

    ⚠️ 为什么用 el-config-provider 而不是 app.use(ElementPlus, { locale })：
      我们是按需引入（unplugin 自动导入），app.use 会把整个库打进来，
      产物从 60KB 级涨到 1MB 级。config-provider 是组件级的，不破坏按需。
  -->
  <el-config-provider :locale="zhCn">
    <router-view />
  </el-config-provider>
</template>
