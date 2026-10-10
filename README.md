# MindForge 前端

MindForge AI 的前端，**一仓两端**（pnpm workspace）：用户端 + 管理端共用一个 Java 后端。

> 📋 **开发进度、代码规范、踩过的坑** 都记在 [PROJECT.md](./PROJECT.md) ——
> 动手前先看一眼那份，能少走不少弯路。

## 目录

```
mindforge-web/
├── apps/
│   ├── admin/          管理端（:5174）
│   └── user/           用户端（:5173）
└── packages/
    └── shared/         两个端共用：API 客户端 / 类型 / token 刷新 / 权限判断
```

## 起服务

```bash
pnpm install                 # 根目录跑一次，两个包一起装

# 需要先起后端：MySQL + Redis + Java（:8080）
pnpm dev:user                # 用户端 → http://localhost:5173/
pnpm dev:admin               # 管理端 → http://localhost:5174/admin/
```

两个端各自的 `/api` 都由 Vite 代理到 `http://localhost:8080`（见各自的 `vite.config.ts`）。
**不需要配跨域**。

⚠️ 两个端**同源部署**时 localStorage 是共享的 —— 所以 token 的 key 前缀必须区分
（`mf_admin_` / `mf_user_`），否则在管理端登录会把用户端的登录态覆盖掉。

> ⚠️ **如果提示 `pnpm: command not found`**
>
> pnpm 是通过 Node 自带的 corepack 提供的，需要在你的终端里启用一次：
>
> ```bash
> corepack enable pnpm
> ```
>
> 这一步要往 Node 的安装目录（如 `D:\nodejs`）写文件，**可能要管理员权限的终端**。
>
> 不想动权限的话，直接用 `corepack pnpm` 代替 `pnpm` 也行：
>
> ```bash
> corepack pnpm install
> corepack pnpm dev:admin
> ```

## 命令对照（npm → pnpm）

| 场景             | npm                         | pnpm                            |
| ---------------- | --------------------------- | ------------------------------- |
| 装全部依赖       | `npm install`               | `pnpm install`                  |
| 加依赖           | `npm install axios`         | `pnpm add axios`                |
| 加开发依赖       | `npm install -D vite`       | `pnpm add -D vite`              |
| 删依赖           | `npm uninstall axios`       | `pnpm remove axios`             |
| 跑脚本           | `npm run dev`               | `pnpm dev`                      |
| 只跑某个子包     | `npm run dev -w apps/admin` | `pnpm --filter admin dev`       |
| 给某个子包加依赖 | `npm i axios -w apps/admin` | `pnpm --filter admin add axios` |

## 为什么要单仓

两个前端打的是同一套 API —— 登录、token 刷新、`{code,message,data}` 拆包、
分页参数、权限判断，这些逻辑只写一次，放在 `packages/shared`。
放两个独立项目的话，那份**最容易改错的 token 刷新逻辑要复制两份**。

## 几个约定

- **路由用 history 模式** —— 地址是 `/admin/users` 而不是 `/admin/#/users`。
  上线时 nginx 要配 `try_files $uri $uri/ /admin/index.html;`，开发时 Vite 已经处理了。
- **管理端 `base` 是 `/admin/`** —— 否则上线后静态资源路径不对（`/assets/xxx.js` 会 404）。
- **权限码来自后端** —— 前端的菜单/按钮隐藏只是 UX，**后端才是真防线**。
- **token 刷新是「单飞」的** —— 后端的 refreshToken 有轮换 + 重放检测，
  并发刷新会被判成重放、直接踢下线。细节见 `packages/shared/src/http.ts` 的注释。
