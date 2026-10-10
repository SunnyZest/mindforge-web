/**
 * ESLint 扁平配置（ESLint 9 的写法，不再用 .eslintrc）。
 *
 * ★ 为什么放在仓库根而不是 apps/admin：
 *   一仓两端 + 一个 shared 包，三个地方都要检查。放根目录只维护一份配置，
 *   将来建 apps/user 时不用再复制一遍。
 *
 * ★ 版本刻意停在 ESLint 9（不是 10）—— 10 刚发布，插件生态还没跟稳。
 */
import pluginVue from 'eslint-plugin-vue'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'

export default defineConfigWithVueTs(
  {
    name: 'mindforge/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue}'],
  },

  {
    name: 'mindforge/ignores',
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      // 下面两个是 unplugin 自动生成的，不是我们写的代码，不该被检查
      '**/auto-imports.d.ts',
      '**/components.d.ts',
      // 设计原型是独立 HTML，不参与工程构建
      'design/**',
    ],
  },

  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,

  {
    name: 'mindforge/rules',
    rules: {
      /**
       * 自动导入的 API（ElMessage / ElMessageBox / ElNotification / ElLoading）
       * 是 unplugin-auto-import 注入的，没有显式 import。
       * `no-undef` 认不出来会全篇报错 —— 但 TS 本来就会检查未定义变量，
       * 这条规则对 TS 项目本来就是冗余的，关掉。
       */
      'no-undef': 'off',

      /**
       * App.vue / AdminLayout.vue 这类是单单词组件名。
       * 这条规则的初衷是防止和 HTML 标签冲突，Vue 3 里其实不需要那么严格。
       */
      'vue/multi-word-component-names': 'off',

      // 允许 `_` 开头的未使用参数（回调签名占位时常用）
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  /**
   * ⚠️ 必须放最后：它把「和 Prettier 冲突的格式类规则」全部关掉，
   * 让 Prettier 独占格式化。顺序反了就没效果。
   */
  skipFormatting,
)
