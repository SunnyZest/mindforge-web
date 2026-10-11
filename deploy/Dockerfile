# ==============================================================================
# MindForge Web 生产部署 Dockerfile（多阶段轻量构建）
# ==============================================================================

# ---------- 第一阶段：前端构建 ----------
FROM node:20-alpine AS builder

WORKDIR /app

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# 复制依赖定义文件利用 Docker 层缓存
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/admin/package.json ./apps/admin/
COPY apps/user/package.json ./apps/user/

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制代码
COPY packages/ ./packages/
COPY apps/ ./apps/
COPY tsconfig.json ./

# 全量构建
RUN pnpm build

# ---------- 第二阶段：Nginx 运行容器 ----------
FROM nginx:1.27-alpine AS runner

# 设置时区
RUN apk add --no-cache tzdata && \
    cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo "Asia/Shanghai" > /etc/timezone && \
    apk del tzdata

# 清空默认配置并写入 MindForge 专属 Nginx 配置
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf

# 拷贝构建产物至目标路径
COPY --from=builder /app/apps/user/dist /var/www/mindforge/user
COPY --from=builder /app/apps/admin/dist /var/www/mindforge/admin

# 暴露端口
EXPOSE 80

# 启动 Nginx
CMD ["nginx", "-g", "daemon off;"]
