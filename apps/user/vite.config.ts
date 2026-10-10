import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { defineConfig } from 'vite'

export default defineConfig({
  /**
   * ⚠️ 用户端 base 是 `/`（管理端是 `/admin/`）。
   *
   * 两个端的部署形态不同：
   *   用户端 —— 站点根目录，访问 http://xxx/
   *   管理端 —— 挂在子路径，访问 http://xxx/admin/
   * 上线时 nginx 先匹配 /admin/ 分流给管理端，剩下的都归用户端。
   *
   * ⚠️ 两个端**同源部署**，所以 localStorage 是共享的 ——
   * token 的 key 前缀必须区分开（见 src/api/index.ts），否则互相覆盖登录态。
   */
  base: '/',

  plugins: [
    vue(),

    // Element Plus 按需引入，理由同管理端：不按需的话整个库会打进产物（1MB+）。
    // 详见 apps/admin/vite.config.ts 里的说明。
    AutoImport({
      resolvers: [ElementPlusResolver()],
      dts: 'auto-imports.d.ts',
    }),
    Components({
      resolvers: [ElementPlusResolver()],
      dts: 'components.d.ts',
    }),
  ],

  resolve: {
    // ⚠️ 正则精确匹配，不能用字符串前缀 —— 否则会把 `@mindforge/shared/styles`
    //    也吃掉，拼成 `.../src/index.ts/styles` 这种不存在的路径。
    alias: [
      {
        find: /^@mindforge\/shared$/,
        replacement: fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)),
      },
      {
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
    /**
     * 端口和管理端错开（管理端 5174）。
     * 5173 是 Vite 的默认端口，用户端占它。
     */
    port: 5173,
    // 后端 context-path 就是 /api，不用 rewrite
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
