# MindForge Web 生产上线与部署指南

本目录包含 MindForge Web 前端（一仓两端：用户端与管理端）的生产部署规范与配置。

| 文件 | 用途 |
| --- | --- |
| `nginx.conf` | 基础版：按 `/admin/` 分流 + IP 白名单 + SSE 流式代理。够开发 / 内网用 |
| `nginx.prod.conf` | **生产版**（HTTPS 部署用）。相对基础版有 4 处硬化，见文件头注释：<br>① 新增 `^~ /api/internal/` 直接 `return 403`（Java 的 `/api/internal/**` 是无用户态、只认共享令牌的内部接口，绝不能被公网代理到）；<br>② `client_max_body_size` 30m → **50m**，与 Spring 的 `max-file-size: 50MB` 对齐（不对齐的话 30~50MB 简历会被 Nginx 先 413 拒掉）；<br>③ `server_name` 说明改为香港地域免备案场景；<br>④ 澄清 Docker 歧义（本 conf 按「Nginx 装在宿主机」编写，upstream 用 `127.0.0.1:8080`；跑容器里要改 `host.docker.internal`） |
| `Dockerfile` / `docker-compose.yml` / `.env.example` | 容器化部署三件套 |

> ⚠️ `nginx.prod.conf` 已纳入版本库 —— 它不含任何密钥，只有 Nginx 行为与占位域名。
> 真机部署前务必核对 `server_name`、证书路径与 `upstream` 地址。

---

## 一、架构与目录映射规范

站点在生产环境中推荐**同源单域名部署**：
- **用户端**（`apps/user`）：挂载于根路径 `/`，静态文件目录 `/var/www/mindforge/user`。
- **管理端**（`apps/admin`）：挂载于子路径 `/admin/`，静态文件目录 `/var/www/mindforge/admin`。
- **后端 API**：反向代理 `/api/` 流量至 Java 后端（默认 `127.0.0.1:8080`）。

> [!IMPORTANT]
> - 管理端 Vite 构建配置 `base: '/admin/'`，请勿修改，否则资源在 `/admin/` 路径下会报 404。
> - 用户端与管理端同源部署共享 `localStorage`，系统已内置前缀隔离（`mf_user_` 与 `mf_admin_`），互不影响。

---

## 二、部署方式一：Docker 容器化部署（推荐）

### 1. 准备配置文件
复制环境变量模板：
```bash
cp deploy/.env.example deploy/.env
```
根据实际情况修改 `DOMAIN_NAME`、HTTP 暴露端口等。

### 2. 构建并启动容器
在仓库根目录或 `deploy` 目录执行：
```bash
docker compose -f deploy/docker-compose.yml up -d --build
```

### 3. 查看日志与状态
```bash
docker compose -f deploy/docker-compose.yml logs -f
```

---

## 三、部署方式二：裸机 Nginx 部署

### 1. 本地或 CI/CD 构建
确保 Node.js >= 20，在根目录执行全量构建：
```bash
pnpm install --frozen-lockfile
pnpm build
```
构建产物将分别生成在：
- `apps/user/dist/`
- `apps/admin/dist/`

### 2. 同步静态文件至服务器
创建目标目录并将产物上传：
```bash
sudo mkdir -p /var/www/mindforge/user /var/www/mindforge/admin
sudo cp -r apps/user/dist/* /var/www/mindforge/user/
sudo cp -r apps/admin/dist/* /var/www/mindforge/admin/
sudo chown -R nginx:nginx /var/www/mindforge
```

### 3. 配置 Nginx
把 `deploy/nginx.conf`（开发 / 内网）或 **`deploy/nginx.prod.conf`（生产，推荐）**
复制或软链接至 `/etc/nginx/conf.d/mindforge.conf`：
```bash
sudo cp deploy/nginx.prod.conf /etc/nginx/conf.d/mindforge.conf
sudo nginx -t
sudo nginx -s reload
```
> HTTPS 建议：先用 `nginx.prod.conf`（仅 80 端口）跑通，再执行
> `sudo certbot --nginx -d <你的域名>` —— certbot 会自动改写文件补上 443 与 301 跳转。

---

## 四、核心配置项说明与安全加固

### 1. 管理端 IP 白名单
在 `deploy/nginx.conf` 的 `location ^~ /admin/` 区块中，解开白名单限制注释：
```nginx
location ^~ /admin/ {
    allow 192.168.1.0/24;  # 仅允许公司内网 / 运维 VPN
    allow 10.0.0.0/8;
    deny all;              # 阻断外部公网直接访问管理端
    ...
}
```

### 2. SSE 流式对话长连接支持
AI 问答模块采用流式长连接输出，`nginx.conf` 中已对 `/api/` 配置了关闭反代缓冲：
```nginx
proxy_buffering off;
proxy_cache off;
chunked_transfer_encoding on;
```
切勿在 API 代理层启用缓冲，否则会导致 SSE 打字机流式输出变成“整段缓冲后一次性吐出”。

### 3. 静态资源缓存策略
- `index.html`（HTML 入口）：配置 `Cache-Control: no-cache, no-store, must-revalidate`，保证发布新版本后用户端立即刷新获取最新资源。
- 带 Hash 的 JS/CSS/图片资源（`/assets/`）：配置 `max-age=31536000, immutable` 一年长缓存，提升二次加载与 CDN 命中率。

### 4. 内部接口拦截（仅 `nginx.prod.conf`）
Java 的内部接口完整路径是 `/api/internal/**`（只认共享令牌、无用户态）。必须在 Nginx 最外层直接挡掉：
```nginx
location ^~ /api/internal/ {
    return 403;   # 从公网打来的都是扫描器；Java↔Python 走 127.0.0.1 不经过 Nginx
}
```
`^~` 保证它优先于 `/api/` 块生效（Nginx 按最长前缀匹配）。**不加这一段，内部 API 会被公网代理出去。**

### 5. 上传体积对齐
`client_max_body_size` 必须与 Spring 的 `multipart.max-file-size` 一致（当前 **50MB**）。
Nginx 小于后端时，30~50MB 的简历会在 Nginx 层先被 413 拒掉，后端配置形同虚设。
`nginx.prod.conf` 已对齐到 `50m`。

### 6. 真实客户端 IP 透传
`/api/` 代理块要带 `X-Real-IP` / `X-Forwarded-For`，且 Java 侧开 `trust-forwarded-headers: true` ——
两者配合，后端限流（100 次/分钟每 IP）与登录失败计数才能按真实客户端 IP 生效，否则会把所有请求算成同一个来源。
