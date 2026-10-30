# MindForge Web

<p align="center">
  <img src="https://img.shields.io/badge/Vue-3.5-4FC08D?style=flat-square&logo=vuedotjs" alt="Vue 3.5" />
  <img src="https://img.shields.io/badge/TypeScript-5.6-3178C6?style=flat-square&logo=typescript" alt="TypeScript 5.6" />
  <img src="https://img.shields.io/badge/Vite-5.x-646CFF?style=flat-square&logo=vite" alt="Vite 5" />
  <img src="https://img.shields.io/badge/Pinia-2.x-FFD859?style=flat-square" alt="Pinia 2" />
  <img src="https://img.shields.io/badge/Element%20Plus-2.14-409EFF?style=flat-square&logo=elementplus" alt="Element Plus 2.14" />
  <img src="https://img.shields.io/badge/ECharts-6.1-AA344D?style=flat-square&logo=apacheecharts" alt="ECharts 6.1" />
  <img src="https://img.shields.io/badge/Package%20Manager-pnpm%20workspace-F69220?style=flat-square&logo=pnpm" alt="pnpm" />
  <img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" alt="License" />
</p>

MindForge Web 是 MindForge AI（企业级求职赋能系统）的前端工程仓库。项目采用 pnpm workspace
Monorepo 架构，在同一个代码仓库中同时维护**面向求职者的用户端**与**面向运营人员的管理端**，
两端共享类型契约、鉴权机制、请求客户端与设计系统。

## 目录

- [简介](#简介)
- [功能特性](#功能特性)
  - [用户端](#用户端)
  - [管理端](#管理端)
- [技术栈](#技术栈)
- [项目结构](#项目结构)
- [快速开始](#快速开始)
- [核心实现](#核心实现)
  - [请求层与 Token 刷新](#请求层与-token-刷新)
  - [二进制接口](#二进制接口)
  - [鉴权与本地存储](#鉴权与本地存储)
  - [数据类型约定](#数据类型约定)
  - [主题与设计系统](#主题与设计系统)
  - [认证与账号](#认证与账号)
- [部署](#部署)
- [许可证](#许可证)

## 简介

求职过程涉及简历、投递、面试、Offer 等多个环节，信息分散在邮件、聊天记录和表格里。
MindForge AI 把这些环节收进一个工作台：简历可解析与改写，投递进度可视化，
面试邀请自动抽取成日程，面试可模拟演练并复盘，多个 Offer 可量化对比。

仓库包含三个包：

| 包                | 说明                   | 开发端口 | 路由 base |
| :---------------- | :--------------------- | :------- | :-------- |
| `apps/user`       | 用户端，面向求职者     | `5173`   | `/`       |
| `apps/admin`      | 管理端，面向运营与运维 | `5174`   | `/admin/` |
| `packages/shared` | 共享模块，两端共用     | —        | —         |

前端依赖两个后端服务：Java 服务（`http://localhost:8080/api`）提供业务接口，
Python AI 服务（`http://localhost:8000`）提供模型调用能力，后者仅由 Java 服务访问。

![工作台首页](docs/screenshots/workspace.webp)

## 功能特性

### 用户端

- **工作台（`/workspace`）**：简历、投递、面试、Offer、错题的数量总览，统计卡可直达对应模块。
- **简历中心（`/resumes`）**：上传 PDF / DOCX 后解析为结构化内容，在线精修，导出服务端渲染的
  PDF；内置 ATS 关键词评分，按目标岗位给出改写建议。
- **目标职位（`/jobs`）**：投递看板、面试日历、卡片列表三种视图。日历支持从 HR 发来的邀约文字
  或附件中抽取面试信息，确认后写入日程。抽取结果要求能在原文中找到对应片段，
  找不到依据的字段直接丢弃——少填一项可以补，填错一项用户通常不会逐条核对。
- **模拟面试（`/interviews`）**：结合简历与岗位 JD 出题，多轮追问，结束后生成复盘报告，
  薄弱点归档到错题本并可单独重练。
- **Offer 对比（`/offers`）**：按薪资、技术栈、平台、加班强度、通勤距离五维加权，调整权重后排名实时更新。
- **薪酬测算（`/salary`）**：按城市、岗位、年限、学历、技能生成年薪区间与年终奖建议。
  置信度由服务端按规则下调（城市不在常见表、岗位不命中关键词、年限越界），不采信模型自评。
- **AI 问答（`/chat`）**：基于知识库的流式问答，回答附带引用来源；检索未命中时回退通用模型并明确标注。
- **知识库（`/knowledge`）与知识检索（`/search`）**：管理个人文档，按语义而非关键词检索。
- **最近删除（`/recycle-bin`）**：恢复误删的 Offer 与面试日程。
- **个人资料（`/profile`）**：昵称、头像、密码与面试邮件提醒开关。

**投递看板** —— 按投递阶段自动归类，每张卡片带匹配度、关联简历、待办提醒与备注。

![投递看板](docs/screenshots/kanban.webp)

**简历结构化** —— 左边是原文，右边是抽取结果；点右侧任意字段，左侧原文对应位置会高亮。

![简历结构化](docs/screenshots/resume-structured.webp)

**面试复盘** —— 雷达图看能力分布，下面分「做得好 / 需改进 / 下一步怎么练」三块。

![面试复盘报告](docs/screenshots/interview-report.webp)

### 管理端

- **运营大盘（`/dashboard`）**：全站核心指标与 Token 消耗趋势。
- **用户管理（`/users`）与角色权限（`/roles`）**：基于 RBAC 的权限矩阵，用户启禁用、角色分配、重置密码。
- **官方智库（`/knowledge-bases`）与文档（`/documents`）**：维护全平台公域知识库，支持批量上传、
  网页 URL 导入、切片预览与失败任务重试。
- **AI 配置（`/ai-models`、`/prompts`）**：配置各用途（对话、向量化、重排）使用的模型，
  并展示当前实际生效的配置及其来源。生效规则统一由服务端计算，前端只展示结果，
  避免多端各自判断产生分歧；管理 Prompt 模板的多个变体，支持发布与回滚。
- **用量与告警（`/usage`、`/alerts`、`/audit-logs`）**：Token 用量统计、高危操作告警、全链路审计日志。
- **设计规范（`/style-guide`）**：设计 token 的可视化文档，深浅两套主题对照。

## 技术栈

| 类别     | 技术         | 版本      | 说明                         |
| :------- | :----------- | :-------- | :--------------------------- |
| 框架     | Vue 3        | `3.5.43`  | 组合式 API，`<script setup>` |
| 语言     | TypeScript   | `5.6.3`   | 全链路强类型                 |
| 构建     | Vite         | `5.4.21`  | 开发热更新与生产分包         |
| 状态管理 | Pinia        | `2.3.1`   | 模块化 store                 |
| 路由     | Vue Router   | `4.6.4`   | History 模式                 |
| UI       | Element Plus | `2.14.7`  | 按需引入                     |
| 图表     | ECharts      | `6.1.0`   | 按需引入，见下方说明         |
| 请求     | Axios        | `1.x`     | 统一拦截器                   |
| 包管理   | pnpm         | `12.10.1` | workspace                    |

依赖版本刻意保持在当前主流稳定档位，而非刚发布的大版本（Vite 5 而非 6、Pinia 2 而非 3、
Vue Router 4 而非 5），以降低生态与文档不完善带来的风险。安装依赖时请显式指定版本号。

`apps/*` 的 `package.json` 使用 `^` 范围声明，上表为实际安装到的版本；仓库根目录的
devDependencies（ESLint、Prettier 等）为精确版本。

ECharts 必须按需引入。全量引入 `import * as echarts from 'echarts'` 会产生约 1.1 MB 的单个
chunk；改为 `echarts/core` 配合 `echarts.use([...])` 后，最大的图表页面 chunk 降至 400 KB 以内。

## 项目结构

```
mindforge-web/
├── apps/
│   ├── user/                    # 用户端（:5173，base: /）
│   │   └── src/
│   │       ├── api/             # 接口层，每个文件导出一个 xxxApi 对象
│   │       ├── components/      # 业务组件
│   │       ├── layouts/         # 布局（顶栏、侧边栏）
│   │       ├── router/          # 路由与菜单定义
│   │       ├── stores/          # Pinia store
│   │       ├── utils/           # 工具函数
│   │       └── views/           # 页面，一个路由对应一个 XxxView.vue
│   └── admin/                   # 管理端（:5174，base: /admin/），结构与用户端一致
└── packages/
    └── shared/                  # @mindforge/shared
        ├── src/
        │   ├── http.ts          # Axios 实例与拦截器
        │   ├── types.ts         # DTO / VO / 枚举等接口契约
        │   ├── permission.ts    # 权限码定义
        │   ├── auth.ts          # Token 持久化
        │   ├── theme.ts         # 主题切换
        │   ├── echarts-theme.ts # 图表主题
        │   ├── format.ts        # 通用格式化函数
        │   ├── progress.ts      # 路由切换时的顶部进度条
        │   ├── router-util.ts   # 带退避重试的异步分包加载
        │   ├── ambient.ts       # 背景极光与指针跟随
        │   └── index.ts         # 统一导出
        └── styles/              # 设计 token、主题、玻璃效果、Element Plus 覆盖
```

`packages/shared` 不做构建，`main` 直接指向 `src/index.ts`，由消费方的 Vite 编译。
这样省去一层构建步骤，修改后立即生效；对应地，`vite.config.ts` 中需要对它设置
`optimizeDeps.exclude`，否则修改 shared 不会触发热更新。

页面组件统一通过 `router-util.ts` 的懒加载封装引入，该封装在模块拉取失败时会自动退避重试，
覆盖开发期依赖优化中断与生产环境旧 chunk 哈希失效两种情况。

## 快速开始

### 环境要求

- Node.js >= 20
- pnpm >= 12（仓库通过 `packageManager` 锁定到 `pnpm@12.10.1`）

```bash
corepack enable pnpm
```

### 安装依赖

```bash
pnpm install
```

### 启动开发服务

启动前需要先运行后端服务：

- **Java 服务**（`http://localhost:8080/api`）— 必需，提供全部业务接口。
- **Python AI 服务**（`http://localhost:8000`）— 使用 AI 功能（简历解析、面试邀约抽取、
  知识库问答）时必需。只启动 Java 服务时页面仍可正常浏览，但 AI 请求会返回服务不可用，
  管理端的 AI 配置页也会显示「读不到当前生效的配置」，两者是同一个原因。

```bash
# 同时启动用户端与管理端
pnpm dev

# 或单独启动
pnpm dev:user    # http://localhost:5173/
pnpm dev:admin   # http://localhost:5174/admin/
```

两个应用的 `vite.config.ts` 都已配置将 `/api` 代理至 `http://localhost:8080`，本地开发无需额外处理跨域。

### 构建与检查

```bash
pnpm typecheck   # vue-tsc 类型检查
pnpm build:user  # 用户端产物 → apps/user/dist
pnpm build:admin # 管理端产物 → apps/admin/dist
pnpm lint        # ESLint
pnpm format      # Prettier
```

## 核心实现

### 请求层与 Token 刷新

`packages/shared/src/http.ts` 封装统一的 Axios 实例，负责三件事：自动附加 `Authorization` 头、
拆解响应信封（调用方直接拿到 `data`）、401 时刷新 Token 并重放原请求。

刷新采用**单飞（single-flight）**策略：后端的 refreshToken 使用轮换机制并检测重放，
同一个 refreshToken 使用一次即失效。如果多个并发请求同时遇到 401 并各自发起刷新，
第二个刷新会被判定为重放，整条会话会被撤销，用户被强制登出。因此同一时刻只允许一个刷新请求，
其余请求等待同一个 Promise 的结果。

登录接口必须携带 `skipRefresh: true`。密码错误时后端同样返回 401，不跳过会被当作会话过期
而去刷新 Token，最终提示「登录已过期」而非「用户名或密码错误」。

### 二进制接口

简历 PDF 导出（`GET /app/resumes/{id}/export`）是唯一经由前端请求层获取二进制的接口。
它成功时返回 `application/pdf` 字节流，失败时仍返回统一的 `{code, message, data}` JSON 信封。
文档下载不经过请求层（由 `window.open` 交给浏览器处理），因此不受以下约束影响。

- **不能使用 `http.get()`**。封装层会读取 `body.code` 判断成功与否，而二进制响应的
  `body.code` 是 `undefined`，会被误判为业务错误。需要使用 `http.raw.get(url, { responseType: 'blob' })`。
- **错误响应需要先读回文本**。`responseType: 'blob'` 会把 JSON 错误体一并包装成 Blob，
  直接读取 `body.code` 拿不到值。`http.ts` 中的 `parseErrorBlob()` 负责读回文本再解析成 `BizError`，
  使调用方拿到的仍是后端返回的错误信息。
- **文件名需从 `Content-Disposition` 解析**。后端返回两段式头
  `filename="resume.pdf"; filename*=UTF-8''%E7%AE%80...`，应优先取 `filename*` 并
  `decodeURIComponent`（中文文件名依赖这一段），取不到再退回 `filename`。

### 鉴权与本地存储

用户端与管理端可能部署在同一域名下，此时 `localStorage` 完全共享。为避免在同一浏览器中
交替登录导致会话串号，两端的存储键使用不同前缀：

| 端     | accessToken             | refreshToken             | 主题             |
| :----- | :---------------------- | :----------------------- | :--------------- |
| 用户端 | `mf_user_access_token`  | `mf_user_refresh_token`  | `mf_user_theme`  |
| 管理端 | `mf_admin_access_token` | `mf_admin_refresh_token` | `mf_admin_theme` |

权限码共 59 个（用户端 31 个、管理端 28 个），集中定义在 `packages/shared/src/permission.ts`，
两端共用。前端依据权限码决定菜单项与按钮是否显示，这属于交互层面的控制，实际的访问控制
由后端的 `@PreAuthorize` 完成。后端新增权限码时需要同步更新该文件。

### 数据类型约定

后端主键为 64 位雪花 ID（如 `1843928174829104821`），超出 JavaScript 安全整数范围
（`2^53 - 1`）。因此前端所有 ID 类型一律声明为 `string`，后端通过 Jackson 序列化为字符串输出，
前端不参与数值运算。

后端返回的字段类型存在几处与直觉不一致的地方，转换在服务端完成，前端按实际类型声明即可：
`RoleVO.id` 是字符串而角色分配的 `roleIds` 是数字数组；`UserSummaryVO.roles` 是角色 code 数组；
`UserProfileVO.reminderEnabled` 是 `1/0` 而更新接口接收布尔值。

### 主题与设计系统

样式分三层：背景层（铺满视口的径向渐变）、内容层（卡片、表格、正文）、玻璃层（侧边栏、顶栏、
弹窗、下拉、浮动工具条）。玻璃效果只用于功能层，配方统一维护在 `styles/glass.css`，提供
标准、强调、贴边、标签四档，并包含 `prefers-reduced-transparency`、`@supports not`、
`prefers-reduced-motion` 三档降级。组件中不应直接书写 `backdrop-filter`。

主题分 `light` 与 `dark` 两档，切换需要三处配合：`index.html` 中的内联脚本在首屏渲染前
写入 `data-theme` 以避免闪烁、`stores/theme.ts` 负责持久化、`main.ts` 负责初始化。

CSS 变量以语义命名（如 `--mf-bg-surface` 而非 `--gray-100`），组件中一律通过 `var(--mf-xxx)`
引用，不书写字面色值。修改 token 前可通过管理端的 `/style-guide` 页面查看深浅两套主题下的效果。

需要注意 `backdrop-filter` 会让元素自身成为 containing block，而 `.el-card` 带有
`overflow: hidden`（用于裁切圆角）。两者叠加时，卡片内弹窗的遮罩会相对卡片定位并被裁切。
因此凡是写在 `<el-card>` 内的 `<el-dialog>` 与 `<el-drawer>`，都需要添加 `append-to-body`。

### 认证与账号

注册需要邮箱与验证码。验证码按钮带 60 秒倒计时，与服务端冷却时间一致，避免用户在冷却期内
重复请求被拒绝。找回密码为公开路由，无论邮箱是否注册，页面提示统一为「如果该邮箱已注册，
验证码会送达」——服务端对未注册邮箱同样返回成功，前端不额外透露账号是否存在。

登录支持用户名与邮箱两种标识。切换只改变输入框文案与校验规则，请求字段始终为 `username`，
由服务端判断：先按用户名查询，未命中且包含 `@` 时再按邮箱查询。

登录后的修改密码不经过邮箱验证码，仅校验原密码并撤销 refreshToken。头像上传在选择文件后
立即提交并返回最新资料，无需再点击保存；头像地址存储为 `/api/app/avatars/{fileId}`，
读取时服务端重定向到对象存储的预签名 URL，因此不会因签名过期而失效。

## 部署

执行 `pnpm build:user` 与 `pnpm build:admin` 生成静态产物，分别位于 `apps/user/dist`、
`apps/admin/dist`，将两者放到服务器的对应目录即可。

两个应用均为 History 路由，管理端带 `/admin/` base，生产环境需要按前缀分流并为每个入口配置
`try_files` 兜底，否则刷新子路由会 404。

```nginx
# 用户端
location / {
    root /var/www/mindforge/user;
    index index.html;
    try_files $uri $uri/ /index.html;
}

# 管理端（可在此追加 IP 白名单或仅允许内网访问）
location /admin/ {
    alias /var/www/mindforge/admin/;
    index index.html;
    try_files $uri $uri/ /admin/index.html;
}

# 后端接口。SSE 流式响应必须关闭缓冲，否则逐字输出会变成一次性返回
location /api/ {
    proxy_pass http://mindforge-backend:8080/api/;
    proxy_http_version 1.1;
    proxy_set_header Connection '';
    proxy_buffering off;
    proxy_cache off;
    chunked_transfer_encoding on;
}
```

管理端产物独立，可单独配置访问策略（内网 IP 白名单、VPN 或独立域名），
不必与面向公网的用户端共用同一入口。

## 许可证

本项目基于 MIT 许可证发布。
