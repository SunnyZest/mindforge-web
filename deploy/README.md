# MindForge Web 生产上线与部署指南

本目录包含 MindForge Web 前端（一仓两端：用户端与管理端）的生产部署规范与配置。

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
将 `deploy/nginx.conf` 复制或软链接至 `/etc/nginx/conf.d/mindforge.conf`：
```bash
sudo cp deploy/nginx.conf /etc/nginx/conf.d/mindforge.conf
sudo nginx -t
sudo nginx -s reload
```

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
