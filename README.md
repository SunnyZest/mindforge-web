# MindForge Web（前端一仓两端 Monorepo）

<p align="center">
  <img src="https://img.shields.io/badge/Vue-3.5-4FC08D?style=flat-square&logo=vuedotjs" alt="Vue 3.5" />
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript" alt="TypeScript 5.8" />
  <img src="https://img.shields.io/badge/Vite-6.x-646CFF?style=flat-square&logo=vite" alt="Vite 6" />
  <img src="https://img.shields.io/badge/Pinia-3.0-FFD859?style=flat-square" alt="Pinia 3" />
  <img src="https://img.shields.io/badge/Element%20Plus-2.9-409EFF?style=flat-square&logo=elementplus" alt="Element Plus" />
  <img src="https://img.shields.io/badge/ECharts-5.6-AA344D?style=flat-square&logo=apacheecharts" alt="ECharts 5.6" />
  <img src="https://img.shields.io/badge/Package%20Manager-pnpm%20workspace-F69220?style=flat-square&logo=pnpm" alt="pnpm" />
  <img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" alt="License" />
</p>

> **MindForge Web** 是 MindForge AI（企业级求职赋能系统）的统一前端工程仓库。  
> 采用 **pnpm workspace Monorepo** 架构，将面向普通求职者的**用户端门户 (User Portal)** 与面向运营运维的**管理控制台 (Admin Console)** 聚合于同一代码仓库，共享核心类型契约、鉴权机制与 API 请求客户端。

---

## 目录

- [一、 架构定位与设计哲学](#一-架构定位与设计哲学)
- [二、 模块构成与功能全景](#二-模块构成与功能全景)
  - [1. 用户端 (apps/user :5173)](#1-用户端-appsuser-5173)
  - [2. 管理端 (apps/admin :5174/admin/)](#2-管理端-appsadmin-5174admin)
  - [3. 共享基座 (packages/shared)](#3-共享基座-packagesshared)
- [三、 技术栈一览](#三-技术栈一览)
- [四、 本地开发与快速上手](#四-本地开发与快速上手)
  - [1. 前置依赖准备](#1-前置依赖准备)
  - [2. 安装依赖](#2-安装依赖)
  - [3. 启动开发服务](#3-启动开发服务)
  - [4. 编译打包与类型检查](#4-编译打包与类型检查)
- [五、 核心工程设计与避坑规约](#五-核心工程设计与避坑规约)
  - [1. 单飞 (Single-Flight) 无感 Token 刷新机制](#1-单飞-single-flight-无感-token-刷新机制)
  - [2. 同源部署 LocalStorage 前缀严格隔离](#2-同源部署-localstorage-前缀严格隔离)
  - [3. 64 位雪花 Long ID 精度防截断](#3-64-位雪花-long-id-精度防截断)
  - [4. HTML5 History 路由与 Nginx 分流部署](#4-html5-history-路由与-nginx-分流部署)
- [六、 未来演进路线图](#六-未来演进路线图)

---

## 一、 架构定位与设计哲学

### 为什么选择 Monorepo（一仓两端）？
1. **消灭多端接口契约漂移**：用户端与管理端均调用后端 Spring Boot 服务（`:8080/api`），两端共享的 DTO、VO 类型与通用枚举（如文档处理状态、面试阶段）在 `packages/shared` 中集中定义，一处修改全局静态检查联动响应；
2. **零重复的防御性请求基座**：将最容易在多端复制出错的双 Token 自动轮转、并发请求队列挂起、全局异常 Toast 等逻辑封装于共享层；
3. **物理隔离与安全可控**：管理端拥有独立路由 base（`/admin/`）与独立打包产物，在生产环境可通过反向代理配置企业内网 IP 白名单或 VPN 访问限制，无需与面向公网的用户端混部。

```
mindforge-web/
├── apps/
│   ├── user/              # 👤 用户端应用 (Vite :5173，面向求职者)
│   └── admin/             # 🛠️ 管理端应用 (Vite :5174，base: /admin/，面向管理员)
└── packages/
    └── shared/            # 📦 共享模块库 (@mindforge/shared)
        ├── src/
        │   ├── http.ts    # 统一 Axios 实例 (单飞 Token 刷新、401 重试队列)
        │   ├── types.ts   # 全局 TypeScript 接口契约
        │   ├── auth.ts    # Token 持久化与解析工具
        │   └── index.ts   # 统一向外导出
```

---

## 二、 模块构成与功能全景

### 1. 用户端 (`apps/user` 监听 `:5173`)
专为互联网求职者打造的端到端提效工作台：
- **求职工作台中枢 (`/workspace`)**：聚合投递进度、当前简历状态、待完成模拟面试与能力雷达评估；
- **智能简历中心 (`/resumes`)**：支持 PDF/DOCX 简历上传，自动结构化提取技能实体、工作量化成果；针对目标岗位提供具象化改写建议；
- **目标 JD 拆解 (`/jobs`)**：深度拆解岗位任职要求，生成“已匹配/表达缺口/证据不足/真实缺口”五维匹配矩阵；
- **全真 AI 模拟面试 (`/interviews`)**：
  - 动态情境化出题：结合候选人简历经历与目标岗位 JD 进行深度追问；
  - 考场交互界面：实时答题计时、多轮追问推进；
  - 四维复盘报告：技术深度、逻辑表达、架构设计评分与标准参考要点对比；
- **AI 智能助手与知识库问答 (`/chat`)**：
  - 支持个人私域知识库关联问答；
  - **零门槛对话**：用户无需强制绑定知识库，默认调用通用模型；
  - **优雅降级**：私域检索未命中时自动无缝兜底专业解答；
  - **流式体验**：基于 SSE 的毫秒级逐字打字机推流与引用来源卡片。

### 2. 管理端 (`apps/admin` 监听 `:5174/admin/`)
企业级运营与运维控制台：
- **运营监控大盘 (`/dashboard`)**：全站求职者指标、面试场次、Token 消耗 ECharts 动态折线与柱状图；
- **用户与权限管控 (`/users`, `/roles`)**：完整的 RBAC 矩阵授权，用户启禁用、角色绑定、重置密码及详情抽屉；
- **官方智库管理 (`/knowledge-bases`)**：创建与管理全平台公域共享的官方智库（如《2026各大厂高频真题集》）；
- **文档全生命周期运维 (`/documents`)**：
  - 多格式本地文档批量上传与状态机跟踪（`PARSING` ➔ `CHUNKING` ➔ `EMBEDDING`）；
  - **一键导入网页 URL**：输入技术博客/面经链接，后端毫秒级清洗提取纯净 Markdown 并自动入库；
  - 向量切片预览与失败任务人工一键重试；
- **AI 基础设施配置 (`/ai-models`, `/prompts`)**：
  - 动态配置大模型供应商、API Key 与 Token 速率上限；
  - 场景 Prompt 模板多变体编辑、发布与一键秒级回滚；
- **系统用量与告警 (`/usage`, `/alerts`, `/audit-logs`)**：
  - Token 用量按天/按模型统计；
  - 危险操作（模型修改、批量删除）实时告警与顶栏未读角标轮询；
  - 完整全链路审计日志查看。

### 3. 共享基座 (`packages/shared`)
- **API 通信契约**：封装全部 HTTP 方法与标准化响应解析；
- **权限安全钩子**：封装 `useAuth`、`hasPermission` 与路由白名单守卫。

---

## 三、 技术栈一览

| 维度 | 技术栈 | 版本 / 选型理由 |
| :--- | :--- | :--- |
| **基础框架** | Vue 3 | `3.5`（组合式 API `<script setup>`） |
| **编程语言** | TypeScript | `5.8`（全链路强类型契约保障） |
| **构建工具** | Vite | `6.x`（极速 HMR 热重载与 Rollup 生产分包） |
| **状态管理** | Pinia | `3.0`（轻量模块化状态管理） |
| **路由管理** | Vue Router | `4.5`（HTML5 History 路由模式） |
| **UI 组件库** | Element Plus | `2.9`（成熟的企业级组件库与主题定制） |
| **数据可视化** | ECharts | `5.6`（高性能交互式图表） |
| **网络请求** | Axios | `1.7`（拦截器与 Single-Flight 并发队列） |
| **包管理器** | pnpm | `12.x`（高效 Workspace 符号链接，杜绝幽灵依赖） |

---

## 四、 本地开发与快速上手

### 1. 前置依赖准备
- **Node.js**：`>= 20.10.0`
- **pnpm**：`9+` 或通过 Corepack 启用：
  ```bash
  corepack enable pnpm
  ```

### 2. 安装依赖
在前端工程根目录下执行（自动并行安装 workspace 内全部包）：
```bash
pnpm install
```

### 3. 启动开发服务
> ⚠️ **前置要求**：请确保 Java 后端服务（`:8080/api`）已正常运行。

```bash
# 同时启动用户端与管理端
pnpm dev

# 或者单独启动用户端（访问 http://localhost:5173/）
pnpm dev:user

# 或者单独启动管理端（访问 http://localhost:5174/admin/）
pnpm dev:admin
```

> 💡 **代理说明**：各应用的 `vite.config.ts` 已内置将 `/api` 请求代理转发至本地 `http://localhost:8080`，本地开发无需后端额外配置 CORS 跨域。

### 4. 编译打包与类型检查

```bash
# 全局严格类型检查（vue-tsc）
pnpm typecheck

# 分别打包用户端与管理端
pnpm build:user      # 产物输出至 apps/user/dist
pnpm build:admin     # 产物输出至 apps/admin/dist

# 代码风格检查与格式化
pnpm lint
pnpm format
```

---

## 五、 核心工程设计与避坑规约

### 1. 单飞 (Single-Flight) 无感 Token 刷新机制
- **痛点**：当页面多个组件并发请求且 Access Token 过期时，如果并发发起多个 `/auth/refresh` 请求，由于后端采用了长效 Token 轮转机制（Rotation），后续请求会被后端防御机制判定为“Token 重放攻击”而强制踢用户下线。
- **解决方案**：在 `packages/shared/src/http.ts` 中维护刷新锁与挂起队列：
  - 仅由首个 401 请求发起 `refresh`；
  - 其余并发请求压入等待队列 `requestsQueue`；
  - 刷新成功后统一更新 Token 并重放队列中的请求，用户全程无感知。

### 2. 同源部署 LocalStorage 前缀严格隔离
- 当用户端与管理端打包部署在同一域名/IP 下时，浏览器的 `localStorage` 是完全共享的。
- **规约**：
  - 用户端所有存储键强制加前缀：`mf_user_access_token`、`mf_user_refresh_token`；
  - 管理端所有存储键强制加前缀：`mf_admin_access_token`、`mf_admin_refresh_token`；
  - 彻底避免在同一浏览器窗口中交替登录导致的串号与顶号问题。

### 3. 64 位雪花 Long ID 精度防截断
- 后端主键采用 64 位雪花算法（如 `1843928174829104821`），超过 JavaScript 的安全整数上限（`2^53 - 1 = 9007199254740991`）。
- **规约**：
  - 前端 TypeScript 类型定义中所有 ID 一律声明为 `string`；
  - 后端 Jackson 序列化输出统一转为字符串，禁止在前端参与数字数学运算。

### 4. HTML5 History 路由与 Nginx 分流部署
由于应用均采用 History 模式且管理端包含 `/admin/` base 路径，生产部署时 Nginx 必须按前缀分流并配置 `try_files` 兜底：

```nginx
# 用户端托管
location / {
    root /var/www/mindforge/user;
    index index.html;
    try_files $uri $uri/ /index.html;
}

# 管理端托管（支持独立内网 IP 控制）
location /admin/ {
    alias /var/www/mindforge/admin/;
    index index.html;
    try_files $uri $uri/ /admin/index.html;
}

# 后端 API 反向代理与 SSE 长连接配置
location /api/ {
    proxy_pass http://mindforge-backend:8080/api/;
    proxy_http_version 1.1;
    proxy_set_header Connection '';
    proxy_buffering off;             # 必须关闭缓冲，确保 SSE 逐字流实时推流
    proxy_cache off;
    chunked_transfer_encoding on;
}
```

---

## 六、 未来演进路线图

- [ ] **求职投递看板 (Kanban CRM)**：在用户端实现类似 Trello 的卡片拖拽看板，打通“岗位 JD + 针对性简历 + 模拟面试复盘”全生命周期；
- [ ] **在线白板手撕代码 (Monaco Editor)**：集成 VS Code 核心在线代码编辑器，支撑算法面试实时编写、语法高亮与用例沙箱评判；
- [ ] **ATS 穿透评分与双栏简历导出**：提供所见即所得的双栏简历编辑器，一键导出高清标准 PDF；
- [ ] **全双工实时语音面试考场**：基于 Web Audio API 采集音频流，配合毫秒级语音识别实现逼真口头对话。
