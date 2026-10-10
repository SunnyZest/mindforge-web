# MindForge 前端 —— 开发进度与规范

> 最后更新：2026-10-10
> 这份文档记「现在做到哪了 + 该怎么写 + 哪些坑踩过」。
> 起服务的说明在 [README.md](./README.md)。
>
> ⚠️ 另有一份**助手用的记忆**在 `.workbuddy-ai/memory/`（不进版本库）。
> 两边内容有重叠，但这份是给人看的、要进仓库的。

---

## 一、项目概览

MindForge AI（AI 求职平台）的前端，**pnpm workspace 一仓两端**：

```
apps/admin        管理端 —— 已完成主体（7 个业务页面）
apps/user         用户端 —— 骨架已建（登录 / 注册 / 工作台 / 个人资料）
packages/shared   两端共用：API 客户端 / 类型 / 权限 / 设计 token
```

后端是**两个独立仓库**，不在本仓里：

| 服务           | 地址                                             | 说明                       |
| -------------- | ------------------------------------------------ | -------------------------- |
| Java 后端      | `D:/java_IDEA/maven_code/mindforge-ai` → `:8080` | context-path = `/api`      |
| Python AI 服务 | `D:/pythoncode/mindforge-ai-service` → `:8000`   | 只给 Java 调，前端不直接碰 |

**为什么一仓两端**：两个端打同一套 API，token 刷新 / 类型 / 权限只写一次；
而且管理端能单独做网络层管控（nginx `allow/deny`）、独立发布、独立回滚。

---

## 二、当前进度

### 页面（管理端）

| 页面     | 路由               | 权限码                 | 状态                                         |
| -------- | ------------------ | ---------------------- | -------------------------------------------- |
| 登录     | `/login`           | —                      | ✅                                           |
| 首页统计 | `/dashboard`       | `admin:dashboard:read` | ✅                                           |
| 用户管理 | `/users`           | `admin:user:list`      | ✅ 增删改 / 分配角色 / 启禁用 / **详情抽屉** |
| 角色权限 | `/roles`           | `admin:role:list`      | ✅ 增删改 / 权限分组勾选                     |
| 知识库   | `/knowledge-bases` | `admin:knowledge:list` | ✅ 列表 / 删除                               |
| 文档     | `/documents`       | `admin:document:list`  | ✅ 列表 / 改状态 / 重试 / 分块查看           |
| AI 配置  | `/ai-models`       | `admin:ai:manage`      | ✅ 增删改                                    |
| 审计日志 | `/audit-logs`      | `admin:audit:list`     | ✅ 列表 + 筛选                               |
| 设计规范 | `/style-guide`     | —                      | ✅ 开发用，深浅两套对照                      |

另有 403 / 404 页，以及 `AdminLayout`（玻璃侧边栏 + 顶栏 + 主题切换）。

### 接口覆盖：管理端 33 个，已接 30 个

```
/admin/auth             4/4    login · me · refresh · logout
/admin/dashboard        1/1
/admin/users            6/7    ← detail 未用
/admin/roles            6/6
/admin/permissions      1/1
/admin/knowledge-bases  2/3    ← detail 未用
/admin/documents        5/6    ← detail 未用
/admin/ai/models        4/4
/admin/audit-logs       1/1
```

未用的 3 个都是「详情」接口 —— 列表页够用，等有详情页时再接。

### 待做

**管理端：功能上已经做完**（7 个页面 + 详情抽屉 + 文档自动刷新）。
剩下的都不是「前端没写」，而是下面这几类：

| 项                                     | 卡在哪                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------ |
| ★ Prompt 管理（`admin:prompt:manage`） | **后端已交付** `/admin/prompts`（增删改查）—— 前端可以做了               |
| ★ AI 用量（`admin:usage:read`）        | **后端已交付** `/admin/usage`（summary / daily / models）—— 前端可以做了 |
| 表格排序                               | **后端不支持** —— `PageQuery` 里没有 sort 参数                           |
| 个人中心 / 改密码                      | **后端没有接口**                                                         |
| 批量操作                               | **后端没有批量接口**                                                     |
| 知识库 / 文档详情                      | 接口有，但**实测返回的字段和列表项完全一样**，接了没意义                 |
| Dashboard 增强                         | 需要后端加统计接口                                                       |

**用户端 `apps/user`：骨架已建，业务页面待做。**

已完成：工程骨架（base `/`、端口 5173）、深浅色自由切换、登录 / 注册 /
工作台 / 个人资料 / 403 / 404、用户端 API 层（认证 + 资料）。

★ **用户端全部做完了**：

| 页面     | 做了什么                                                        |
| -------- | --------------------------------------------------------------- |
| 我的简历 | 上传 / 解析 / 左原文·右结构化对照 / AI 优化建议（两类建议分开） |
| 目标职位 | 录入 JD / 解析 / 对照 / 技能按「硬性要求·加分项」分组           |
| 模拟面试 | 五步流程（创建→出题→开始→逐题作答→报告）+ 逐题点评              |
| 知识库   | 列表 / 文档上传 / 三阶段进度 / 自动刷新                         |
| AI 问答  | SSE 流式 + 引用溯源（点引用看原文片段）                         |

`ComingSoonView` 现在没有页面在用了，留着给下一个新功能当占位。

后端 55 个用户端端点都已就绪。四个想特别做好的点：

- ✅ 简历详情【左原文 / 右结构化】的对照已做 —— 点右边的技能/公司，
  左边原文里对应的地方会高亮并滚过去（用 indexOf，别用正则，值里可能有 `C++`）
- 匹配报告用【五类结论】而不是百分比
- RAG 问答把【引用溯源】标在正文里（后端已有 chunk → document 的溯源链）
- ✅ 简历优化的 `needsFact` 两类已经**分开展示**（绿色实线 vs 橙色虚线）。
  ⚠️ 这条是整个产品里最不能做错的：
  会让用户以为 AI 替他编好了经历，面试里一追问就露馅，**比不改还糟**

字段细节见 `.workbuddy-ai/memory/MEMORY.md` 的「后端新增接口」一节。

**其它**：上线时的 nginx 配置（按 `/admin/` 分流 + 管理端可加 IP 白名单）；
可选接 OpenAPI 代码生成，把手抄的类型换成生成。

---

## 三、开发规范

### 技术栈（版本刻意停在主流那一档）

```
Vue 3.4 · Vite 5 · TypeScript 5.6 · Pinia 2 · vue-router 4 · Element Plus 2.7
@vitejs/plugin-vue 5 · vue-tsc 2.1 · unplugin-auto-import 0.18 · unplugin-vue-components 0.27
eslint 9.39.5 · prettier 3.9.9 · eslint-plugin-vue 10.11.1
@vue/eslint-config-typescript 14.9.0 · @vue/eslint-config-prettier 10.2.0
```

⚠️ **不用刚发布的大版本**（Vite 8 / vue-router 5 / Pinia 4 / ESLint 10 都刚出，
生态和文档没跟上）。**装依赖必须显式写版本号**，别 `pnpm add xxx` 不带版本。

### 代码检查

```bash
pnpm lint          # ESLint 检查
pnpm lint:fix      # 自动修能修的
pnpm format        # Prettier 格式化
pnpm format:check  # 只检查不修改（CI 用）
pnpm typecheck     # vue-tsc 类型检查
```

配置在**仓库根**（一仓两端共用一份）：
`eslint.config.js`（ESLint 9 扁平配置）· `.prettierrc.json` · `.prettierignore`

格式约定（**对齐现有代码量出来的，不是照抄默认值**）：

| 选项            | 值      | 依据                               |
| --------------- | ------- | ---------------------------------- |
| `semi`          | `false` | 现有 `.ts` 行尾分号 0 处           |
| `singleQuote`   | `true`  | import 单引号 141 行 / 双引号 0 行 |
| `printWidth`    | `100`   | 现有最长行 105 字符                |
| `trailingComma` | `all`   | 多行对象都带尾逗号                 |

⚠️ `.prettierrc.json` 里**不能写 `//xxx` 注释键** —— Prettier 会逐条告警
「Ignored unknown option」。想写说明就放 `.prettierrc.js`（JS 支持注释）或文档里。

**提交前建议跑一遍** `pnpm lint && pnpm typecheck`。

### 目录约定

```
apps/admin/src/
├── api/          按后端 Controller 分模块，一个模块一个文件
├── components/   跨页面复用的组件（对话框 / 状态标签）
├── layouts/      AdminLayout
├── stores/       Pinia（auth / theme）
├── utils/        format.ts 等纯函数
└── views/        一个路由一个文件，命名 XxxView.vue
```

### 代码风格

- **显式 import**：刻意**没有**把 `vue` / `vue-router` / `pinia` 的 API 加进自动导入 ——
  `ref` / `computed` 凭空出现会看不出从哪来。Element Plus 的组件和 `ElMessage` 是自动导入的。
- **注释写「为什么」不写「是什么」**：代码本身能说明做什么，注释要留给
  「为什么这么定 / 踩过什么坑 / 改了会怎样」。项目里的注释密度偏高，是刻意的。
- **页面里一律用 `var(--mf-xxx)`**，不要写死像素和色值。

### 提交规范

- conventional 前缀 + 中文描述；**正文 3~5 行**，不写「阶段 N」这种内部说法
- **按功能分批**，别把不相关的改动塞进一笔
- **提交前先问**，不默默 commit
- **推送由你自己做** —— 助手不碰 `git push`
- 远程名是 `mindforge-web`（**不是 `origin`**），`main` 已跟踪它，直接 `git push` 即可

---

## 四、设计系统

### 分层原则（最重要的一条）

```
背景层   body 多层径向渐变「壁纸」 —— 必须铺满视口，中心不能留白
内容层   卡片 / 表格 / 正文 —— 保持较不透明，保证可读性
玻璃层   侧边栏 / 顶栏 / 弹窗 / 下拉 / 浮动工具栏 —— Liquid Glass
```

**玻璃只用于功能层**，内容层大面积做重玻璃会既卡又糊。

```
packages/shared/styles/
├── tokens.css        底座：间距 / 圆角 / 字号 / 动效 / 玻璃强度
├── theme-light.css   浅色，挂 :root 和 [data-theme='light']
├── theme-dark.css    深色，挂 [data-theme='dark']
├── glass.css         ★ 液态玻璃工具类 + 三档无障碍降级
├── element-plus.css  把 token 映射到 EP 的 CSS 变量，并给 EP 组件套玻璃
└── index.css         汇总入口
```

### 四条不能改坏的规则

1. **变量名用「语义」不用「外观」**（`--mf-bg-surface` 而不是 `--gray-100`）——
   深色主题才能只换值、不换名
2. **选择器写 `:root:root`** —— EP 按需引入时每个组件样式里都带一份 `:root`，
   只写 `:root` 会「有时候生效有时候不生效」。**不是笔误，别改回去**
3. **`color-mix` 混 `var(--mf-bg-surface)` 而不是混白** —— 一个表达式两边都对
4. **组件级覆盖只改 EP 变量，不写选择器** —— 同理避开权重问题

### 主题切换（三个环节缺一不可）

1. `apps/admin/index.html` 的**内联脚本** —— 首屏渲染前挂 `data-theme`，防 FOUC
2. `apps/admin/src/stores/theme.ts` —— Pinia store，写 localStorage
3. `apps/admin/src/main.ts` 里 `useThemeStore(pinia)` —— 保证进应用时 store 已创建

localStorage key = `mf_admin_theme`（**index.html 和 store 里各写一遍，改要改两处**）。

---

## 五、注意事项（踩过的坑）

### 1. ★ 卡片里的弹窗必须加 `append-to-body`

`backdrop-filter` 会让元素**自己成为 containing block**。而 `.el-card` 同时有
`backdrop-filter`（我们的玻璃）和 `overflow: hidden`（EP 默认，为了裁到圆角）——
于是**渲染在卡片内部的弹窗**，其 `position: fixed` 遮罩层变成「相对卡片定位」，再被卡片裁掉。

**症状**：比卡片高的弹窗只渲染出顶部一小截，位置还会偏移。矮的弹窗看起来正常，所以很晚才发现。

**规矩：凡是在 `<el-card>` 里写的 `<el-dialog>` / `<el-drawer>`，一律加 `append-to-body`。**

### 2. ★ 验证渲染不能只读 DOM

`[...buttons].map(textContent)` 只能证明文字**在 DOM 里**，证明不了**看得见**。
这类问题要用 `getBoundingClientRect()` 量坐标。

**排查提醒**：「DOM 尺寸正确但渲染被切」优先怀疑**祖先的 overflow 裁剪**，
不要一上来就怀疑渲染管线 / headless / GPU。

### 3. 玻璃配方只允许有一份

在 `glass.css` 里，**不要在组件里手写 `backdrop-filter`** ——
手写的那份会漏掉无障碍降级（`prefers-reduced-transparency` 等）。

⚠️ 浅色玻璃调不出效果的根因**不是着色**，是「背景太浅 + `brightness` 又提亮」。
正解 = 背景给足色彩 + 浅色下 `--mf-glass-brightness` 设 100%（深色才用 106%）。

### 4. 表格列宽按「最窄的常见视口」算

1366×768 笔记本浏览器最大化后，内容区只有约 1040px。
超了会横向滚动，而 `fixed="right"` 的操作列会**盖住前一列**。
**改列宽时重新加一遍总数。**

### 5. 危险操作才加二次确认

判断标准 = 「有没有破坏性 + 能不能自己撤销」：

```
确认：删除用户 / 禁用用户 / 删除角色 / 角色改成禁用 / 权限清空 / 角色清空
不确认：启用用户（恢复性）/ 编辑资料 / 新增
```

一视同仁地都弹确认，会让人形成「闭眼点确定」的习惯，真危险的确认就失效了。

⚠️ **「清空」的语义是「空数组 = 清空，不是不改」**（后端约定）——
要用打开时的数量对比，才知道是不是真的「从有到无」。

### 6. Element Plus 中文语言包

`App.vue` 用 `<el-config-provider :locale="zhCn">` 包住路由出口。
不配的话 MessageBox 按钮是英文 `Cancel`、分页是 `Total 2`。

⚠️ **别用 `app.use(ElementPlus, { locale })`** —— 按需引入会被破坏，产物从 60KB 涨到 1MB。

### 7. 两个后端类型不一致的地方

- `RoleVO.id` 是 **string**，但 `AssignRolesDTO.roleIds` 要 **number[]** ——
  分配角色时必须 `Number(role.id)` 转一下
- `UserSummaryVO.roles` 是**角色 code 数组**（`['USER']`），不是 id 数组

### 8. el-table 插槽的 `row` 是 `DefaultRow` 类型

直接传给 `onXxx(row: UserSummaryVO)` 会类型不匹配。
统一用 `asUser()` / `asRole()` 这类转换函数处理，别在模板里散写断言。

### 9. 环境坑（只影响助手，不影响你）

- **dev server 会被「加新 EP 组件」搞崩**：Vite 重新优化依赖时删 `deps_temp_*`，
  撞上助手沙箱的批量删除保护。**绕开办法**：用 `vite build` + `vite preview` 验证
- **本机代理会劫持 127.0.0.1**：shell 里有 `http_proxy`，curl 要加 `--noproxy '*'`，
  node 设 `NO_PROXY`，浏览器加 `--no-proxy-server`
- 助手用**托管 node**（`C:\Users\crxxxyy\.workbuddy-ai\binaries\node\versions\22.22.2-6`）
  才能跑 Vite

---

## 六、后端契约速查

### 统一信封

```ts
{ code: number, message: string, data: T, traceId?: string }
```

`code === 0` 才是成功。共享层的 `http` 已经把信封拆掉，调用方直接拿 `data`。

### 错误码分流

```
401xx → 走刷新（共享层自动做）；刷新也失败 → 清 token → 跳登录
40301 → 「无权限」（后端对【别人的资源】刻意返 404 而不是 403，不泄漏存在性）
42901 → 后端限流 100 次/分钟每 IP，响应带 Retry-After: 60
502xx → AI 服务问题，提示「AI 服务繁忙，请重试」
```

### 路径与 token

```
用户端  /api/app/auth/login    · /app/auth/refresh   · /app/auth/logout   · /app/auth/me
管理端  /api/admin/auth/login  · /admin/auth/refresh · /admin/auth/logout · /admin/auth/me

accessToken   30 分钟
refreshToken  带【轮换 + 重放检测】—— 一个用过一次就失效
```

### 共享层里两个不能改错的地方（`packages/shared/src/http.ts`）

1. **单飞刷新** —— 三个请求同时 401、三个都去刷新的话，第二个会被判成「重放」，
   **整条会话直接被撤销**。所以同一时刻只允许一个刷新请求
2. **登录接口必须带 `skipRefresh: true`** —— 密码错时后端返回的也是 401，
   不跳过会被当成「会话过期」，用户看到的是「登录已过期」而不是「密码错误」

### 分页

```ts
{
  ;(page, pageSize, total, records)
}
```

### 权限码

48 条（用户端 24 + 管理端 24），清单在 `packages/shared/src/permission.ts` 的联合类型里。
**前端拿它决定菜单和按钮显不显示 —— 那只是 UX，后端每个接口都有 `@PreAuthorize`，
那才是真防线。**

⚠️ 以 `mindforge-schema.sql` 为准（另一份 `*-RBAC.sql` 是旧版，含已废弃的 `admin:role:manage`）。
