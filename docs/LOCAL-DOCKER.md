# BrainAge 本地容器构建与部署

以下命令在仓库根目录的 PowerShell 中执行。Windows 使用 Docker Desktop 的 Linux 引擎。开发与生产使用不同的 Compose 项目名，可同时运行。

## 1. 检查环境

```powershell
docker context ls
docker --context desktop-linux version
docker compose version
docker --context desktop-linux compose -p brainage-dev -f compose.dev.yaml config --quiet
docker --context desktop-linux compose -p brainage-prod -f compose.prod.yaml config --quiet
```

version 应同时列出 Client 和 Server，Server 的 OS 应为 linux。若只有 Client，检查 Docker Desktop 是否启动，以及当前终端是否有权访问 Linux 引擎。Linux 主机可去掉命令中的 --context desktop-linux。默认端口 5173 和 8080 应可用。

## 2. 构建开发容器

```powershell
docker --context desktop-linux compose -p brainage-dev -f compose.dev.yaml up -d --build
docker --context desktop-linux compose -p brainage-dev -f compose.dev.yaml logs --tail=100 web
curl.exe --fail http://127.0.0.1:5173/
docker --context desktop-linux compose -p brainage-dev -f compose.dev.yaml exec -T web npm run typecheck
docker --context desktop-linux compose -p brainage-dev -f compose.dev.yaml exec -T web npm run lint
docker --context desktop-linux compose -p brainage-dev -f compose.dev.yaml exec -T web npm test
```

Docker 使用仓库根作为构建上下文，读取 apps/web/Dockerfile，基于 Node 22 镜像复制依赖清单并执行 npm ci。启动时，Compose 把 apps/web 挂载到容器的 /app，单独用命名卷存放容器依赖。启动命令按锁文件安装依赖后运行 Vite。访问 http://127.0.0.1:5173/，修改源码可触发热更新。

Windows 下文件监听失效时，可在启动前设置 PowerShell 环境变量 `$env:BRAINAGE_WATCH_POLLING = 'true'`，再执行同一条 up 命令。

## 3. 构建并部署生产容器

```powershell
docker --context desktop-linux compose -p brainage-prod -f compose.prod.yaml up -d --build --wait --wait-timeout 120
docker --context desktop-linux compose -p brainage-prod -f compose.prod.yaml ps
curl.exe --fail http://127.0.0.1:8080/healthz
curl.exe --fail http://127.0.0.1:8080/
```

生产构建先运行 TypeScript 检查与 Vite 构建，再将 dist 复制到 Nginx 镜像。访问 http://127.0.0.1:8080/，健康检查应返回 ok。打开 http://127.0.0.1:8080/#/training 后刷新，可验证 Hash 路由。生产端口绑定宿主机回环地址。需要通过域名访问时，将宿主机 HTTPS 反向代理的上游设置为 http://127.0.0.1:8080。

上线前确定固定域名和协议。应用使用浏览器本地存储，127.0.0.1:5173、127.0.0.1:8080 和正式 HTTPS 域名各有独立记录。

## 4. 日志、更新与停止

```powershell
docker --context desktop-linux compose -p brainage-prod -f compose.prod.yaml logs --tail=100 web
docker --context desktop-linux compose -p brainage-prod -f compose.prod.yaml images
docker --context desktop-linux compose -p brainage-prod -f compose.prod.yaml up -d --build --wait --wait-timeout 120
docker --context desktop-linux compose -p brainage-dev -f compose.dev.yaml down
docker --context desktop-linux compose -p brainage-prod -f compose.prod.yaml down
```

更新源码后重新运行 up 命令即可构建并替换容器。普通 down 会保留开发依赖卷。遇到拉取超时，查看构建输出中是 Docker Hub 镜像元数据超时还是 npm 下载失败，再检查 Docker Desktop 的代理配置与对应服务的连接。

## 5. Docker Hub 暂不可达时预览生产产物

若本机已有 nginx:latest 镜像，可先在宿主机运行 npm 构建，再用该镜像和仓库中的 Nginx 配置提供服务。此路径验证静态站点和 Nginx 配置。正式镜像仍按第 3 节构建。

```powershell
Push-Location apps/web
try {
    npm ci
    if ($LASTEXITCODE -ne 0) { throw '依赖安装失败' }
    npm run build
    if ($LASTEXITCODE -ne 0) { throw '前端构建失败' }
} finally {
    Pop-Location
}

$dist = (Resolve-Path 'apps/web/dist').Path
$config = (Resolve-Path 'apps/web/nginx.conf').Path
docker --context desktop-linux run -d --name brainage-local-preview --pull never `
    -p 127.0.0.1:8080:80 `
    --mount "type=bind,source=$dist,target=/usr/share/nginx/html,readonly" `
    --mount "type=bind,source=$config,target=/etc/nginx/conf.d/default.conf,readonly" `
    nginx:latest
curl.exe --fail http://127.0.0.1:8080/healthz
```

切换到生产 Compose 前，先释放 8080 端口。

```powershell
docker --context desktop-linux stop brainage-local-preview
docker --context desktop-linux rm brainage-local-preview
```

如果目标机器不能访问 Docker Hub，可在网络可达且架构匹配的机器完成构建，通过 docker save 导出构建后的镜像，再在目标机器上使用 docker load 导入。
