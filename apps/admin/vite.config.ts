import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { defineConfig } from 'vite'

export default defineConfig({
  // ⚠️ 上线时 nginx 把 /admin/ 分给管理端的产物，所以 base 必须是 /admin/。
  //    不配的话产物里的资源路径是 /assets/xxx.js，分流后直接 404。
  //    开发时也用同一个值（dev 地址就是 http://localhost:5174/admin/）——
  //    这样 dev 和 prod 的路径一致，base 相关的坑在开发阶段就能踩到。
  base: '/admin/',

  plugins: [
    vue(),

    // Element Plus 按需引入。
    // 不加这两个插件的话整个库会打进产物（1MB+），而且首屏白屏时间明显变长。
    // - AutoImport  负责「函数式」的（ElMessage / ElMessageBox / ElNotification）
    // - Components  负责「标签式」的（<el-button> / <el-table>）
    //
    // ⚠️ `dts` 必须显式写 —— 不写的话不会生成声明文件，
    //    vue-tsc 就不知道 `ElMessage` 和 `<el-button>` 是什么，类型检查直接报错。
    //
    // ⚠️ 刻意【没有】把 vue / vue-router / pinia 的 API 加进 imports 自动导入 ——
    //    那样 ref / computed / onMounted 会凭空出现，看不出是从哪来的。
    //    显式 import 对新学的人更清楚，代价只是多写一行。
    AutoImport({
      resolvers: [ElementPlusResolver()],
      dts: 'auto-imports.d.ts',
    }),
    Components({
      resolvers: [ElementPlusResolver()],
      dts: 'components.d.ts',
    }),
  ],

  optimizeDeps: {
    exclude: ['@mindforge/shared'],
    include: [
      'vue',
      'vue-router',
      'pinia',
      'echarts',
      'element-plus',
      '@element-plus/icons-vue',
      'element-plus/es',
      'element-plus/es/components/alert/style/css',
      'element-plus/es/components/aside/style/css',
      'element-plus/es/components/badge/style/css',
      'element-plus/es/components/button/style/css',
      'element-plus/es/components/card/style/css',
      'element-plus/es/components/checkbox/style/css',
      'element-plus/es/components/checkbox-group/style/css',
      'element-plus/es/components/config-provider/style/css',
      'element-plus/es/components/container/style/css',
      'element-plus/es/components/date-picker/style/css',
      'element-plus/es/components/descriptions/style/css',
      'element-plus/es/components/descriptions-item/style/css',
      'element-plus/es/components/dialog/style/css',
      'element-plus/es/components/drawer/style/css',
      'element-plus/es/components/dropdown/style/css',
      'element-plus/es/components/dropdown-menu/style/css',
      'element-plus/es/components/dropdown-item/style/css',
      'element-plus/es/components/empty/style/css',
      'element-plus/es/components/form/style/css',
      'element-plus/es/components/form-item/style/css',
      'element-plus/es/components/header/style/css',
      'element-plus/es/components/icon/style/css',
      'element-plus/es/components/input/style/css',
      'element-plus/es/components/input-number/style/css',
      'element-plus/es/components/loading/style/css',
      'element-plus/es/components/main/style/css',
      'element-plus/es/components/menu/style/css',
      'element-plus/es/components/menu-item/style/css',
      'element-plus/es/components/message/style/css',
      'element-plus/es/components/message-box/style/css',
      'element-plus/es/components/notification/style/css',
      'element-plus/es/components/option/style/css',
      'element-plus/es/components/option-group/style/css',
      'element-plus/es/components/pagination/style/css',
      'element-plus/es/components/popconfirm/style/css',
      'element-plus/es/components/progress/style/css',
      'element-plus/es/components/radio/style/css',
      'element-plus/es/components/radio-button/style/css',
      'element-plus/es/components/radio-group/style/css',
      'element-plus/es/components/result/style/css',
      'element-plus/es/components/select/style/css',
      'element-plus/es/components/skeleton/style/css',
      'element-plus/es/components/skeleton-item/style/css',
      'element-plus/es/components/switch/style/css',
      'element-plus/es/components/table/style/css',
      'element-plus/es/components/table-column/style/css',
      'element-plus/es/components/tabs/style/css',
      'element-plus/es/components/tab-pane/style/css',
      'element-plus/es/components/tag/style/css',
      'element-plus/es/components/timeline/style/css',
      'element-plus/es/components/timeline-item/style/css',
      'element-plus/es/components/tooltip/style/css',
      'element-plus/es/components/upload/style/css',
    ],
  },

  resolve: {
    // ⚠️ 这里必须用【正则精确匹配】，不能用字符串前缀：
    //    字符串别名会把 `@mindforge/shared/styles` 也吃掉，
    //    拼成 `.../src/index.ts/styles` 这种不存在的路径。
    alias: [
      {
        find: /^@mindforge\/shared$/,
        replacement: fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)),
      },
      {
        // 样式单独指到 CSS 文件 —— 不依赖 package.json 的 exports 映射，
        // 免得「exports 写对了但构建器不认」这种问题（CSS 的解析路径各构建器有差异）
        find: /^@mindforge\/shared\/styles$/,
        replacement: fileURLToPath(
          new URL('../../packages/shared/styles/index.css', import.meta.url),
        ),
      },
      {
        find: '@',
        replacement: fileURLToPath(new URL('./src', import.meta.url)),
      },
    ],
  },

  server: {
    port: 5174,
    // 后端的 context-path 就是 /api，所以不用 rewrite
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
