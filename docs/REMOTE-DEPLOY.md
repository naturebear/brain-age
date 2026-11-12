# BrainAge 远程服务器部署

本文以一台有 sudo 权限的 Ubuntu 24.04 服务器为例。将命令中的 ubuntu、SERVER_IP 和 brainage.example.com 换成你的 SSH 用户、服务器地址和实际域名。服务器构建阶段需要访问 GitHub、镜像仓库和 npm 仓库。Node 在 Docker 构建阶段运行，服务器可直接用 Docker 部署。

## 初次部署指南

### 1. 登录服务器并拉取代码

在本机终端登录，然后在服务器安装 Git。

```bash
ssh ubuntu@SERVER_IP
sudo apt update
sudo apt install -y git curl ca-certificates
```

仓库已公开，可直接通过 HTTPS 克隆。

```bash
git clone --branch main https://github.com/naturebear/brain-age.git ~/brain-age
```

进入仓库确认当前提交。

```bash
cd ~/brain-age
git log -1 --oneline
```

### 2. 安装 Docker Engine、Buildx 和 Compose

已安装可用 Docker 的服务器，先检查 `sudo docker version`、`sudo docker buildx version` 和 `sudo docker compose version`，三项均可用即可进入下一节。新 Ubuntu 主机使用 Docker 官方 APT 源。其他发行版按对应官方安装页面操作。[Docker Engine Ubuntu 安装文档](https://docs.docker.com/engine/install/ubuntu/)

```bash
sudo install -d -m 0755 /etc/apt/keyrings
sudo curl -fsSLo /etc/apt/keyrings/docker.asc https://download.docker.com/linux/ubuntu/gpg
sudo chmod a+r /etc/apt/keyrings/docker.asc
. /etc/os-release
arch=$(dpkg --print-architecture)
printf 'Types: deb\nURIs: https://download.docker.com/linux/ubuntu\nSuites: %s\nComponents: stable\nArchitectures: %s\nSigned-By: /etc/apt/keyrings/docker.asc\n' "${UBUNTU_CODENAME:-$VERSION_CODENAME}" "$arch" | sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker version
sudo docker buildx version
sudo docker compose version
```

### 3. 构建并启动生产容器

先在服务器同步已有仓库。首次克隆后也可以执行这段命令。确认输出的提交是要部署的版本，再开始构建。若切换分支或拉取失败，先处理本地修改或分支分歧。

```bash
cd ~/brain-age &&
  git switch main &&
  git pull --ff-only origin main &&
  git log -1 --oneline
```

默认构建和下方的 ECR 构建都使用这个工作目录中的代码。

```bash
cd ~/brain-age
sudo docker compose -p brainage-prod -f compose.prod.yaml config --quiet
sudo docker compose -p brainage-prod -f compose.prod.yaml build
sudo docker compose -p brainage-prod -f compose.prod.yaml up -d --no-build --wait --wait-timeout 120
sudo docker compose -p brainage-prod -f compose.prod.yaml ps
curl -fsS http://127.0.0.1:8080/healthz
curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8080/
```

构建先用 Node 安装锁定依赖并生成网页，再把产物复制到 Nginx 镜像。验收时容器应显示 healthy，健康端点返回 ok，首页返回 200。端口 8080 绑定到服务器回环地址。

若连接 Docker Hub 的 registry-1.docker.io 或 auth.docker.io 超时，可通过构建参数使用 Docker 在 Amazon ECR Public 发布的同版本基础镜像。构建成功后执行上面的 up 和检查命令。[Docker 的 ECR Public 镜像仓库](https://gallery.ecr.aws/docker/)

```bash
cd ~/brain-age
sudo docker compose -p brainage-prod -f compose.prod.yaml build \
  --build-arg BRAINAGE_IMAGE_PREFIX=public.ecr.aws/docker/library/
```

若服务器也无法访问 npm，可在网络可达、CPU 架构匹配的机器构建同名镜像，用 `docker image save -o brainage-prod-web.tar brainage-prod-web:latest` 导出，传到服务器后用 `sudo docker image load -i brainage-prod-web.tar` 导入，再执行第 3 节的 up 命令并追加 `--pull never`。

### 4. 浏览器访问

**无域名，自己验收。** 通过 SSH 隧道直接访问容器即可。在自己的电脑上另开终端，保持连接开启，然后用浏览器打开 http://127.0.0.1:18080/。

```bash
ssh -N -L 127.0.0.1:18080:127.0.0.1:8080 ubuntu@SERVER_IP
```

BrainAge 创建测评和练习记录时会调用 `crypto.randomUUID()`，需要浏览器安全上下文。本机回环地址满足该要求。通过服务器 IP 使用普通 HTTP 时，即使首页能打开，测评和记录功能也可能报错。[MDN 安全上下文说明](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts) · [randomUUID 文档](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID)

**无域名，多台受控设备通过 IP 访问。** 在服务器安装 Caddy，将以下站点块加入 `/etc/caddy/Caddyfile`。用客户端实际访问的服务器 IP 替换示例地址，并在防火墙放行访问设备到 Caddy 的 TCP 443。容器端口 8080 继续绑定服务器回环地址。[Caddy 安装指南](https://caddyserver.com/docs/install#debian-ubuntu-raspbian)

```caddyfile
https://203.0.113.10 {
    tls internal
    reverse_proxy 127.0.0.1:8080
}
```

```bash
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile &&
  sudo systemctl reload caddy
```

默认 Ubuntu systemd 安装生成的根证书位于 `/var/lib/caddy/.local/share/caddy/pki/authorities/local/root.crt`。通过可信渠道把 `root.crt` 传到受控设备，导入系统或浏览器的受信任根证书库。随后访问 `https://实际服务器IP/` 并完成一次测评。面向公众的 IP HTTPS 需要为该公网 IP 签发的公开受信任证书。[Caddy 内部 HTTPS 与根证书位置](https://caddyserver.com/docs/running#local-https)

**使用域名对外提供服务。** 把域名 A 记录指向服务器公网 IPv4，有公网 IPv6 时再设置 AAAA。在云安全组和主机防火墙放行 TCP 80、443，保留 SSH 管理入口。已有反向代理时，为 BrainAge 域名增加指向 `http://127.0.0.1:8080` 的站点。

新服务器可按官方 Ubuntu 指南安装 Caddy。在 `/etc/caddy/Caddyfile` 中添加以下站点。已有站点配置时追加该块。Caddy 需要能占用 80、443 来提供公开 HTTPS。[Caddy 安装](https://caddyserver.com/docs/install#debian-ubuntu-raspbian) · [自动 HTTPS 的要求](https://caddyserver.com/docs/automatic-https#overview)

```caddyfile
brainage.example.com {
    reverse_proxy 127.0.0.1:8080
}
```

```bash
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl reload caddy
curl -fsS https://brainage.example.com/healthz
```

用实际 HTTPS 域名打开网站并完成一次测评。记录保存在当前浏览器，域名、协议或端口变化会使用不同的存储空间。

## 版本更新部署指南

**通常可以在服务运行时更新代码和构建镜像。** 当前生产容器使用镜像内的静态文件，Git 拉取和镜像构建期间会继续提供旧版本。构建成功后，由 Compose 替换容器。BrainAge 使用单容器和固定端口，替换时可能短暂中断。保留反向代理运行。

### 1. 检查状态并保留当前版本

在服务器登录原部署用户。沿用首次部署时的目录、Compose 文件和项目名。

```bash
cd ~/brain-age
git status --short --branch
sudo docker compose -p brainage-prod -f compose.prod.yaml ps
curl -fsS http://127.0.0.1:8080/healthz
```

确认部署目录没有需要保留的本地修改，且旧容器健康。把下面的命令作为一段执行。记录输出的旧提交号，供核对和回滚配置时使用。回滚标签从当前运行的容器取镜像 ID，即使此前构建过尚未上线的镜像，也能保留真正在线的版本。

```bash
(
  set -e
  cd ~/brain-age
  git rev-parse HEAD
  container_id=$(sudo docker compose -p brainage-prod -f compose.prod.yaml ps -q web)
  test -n "$container_id"
  running_image=$(sudo docker inspect --format '{{.Image}}' "$container_id")
  sudo docker image tag "$running_image" brainage-prod-web:previous
)
```

### 2. 拉取代码并构建

```bash
cd ~/brain-age
git switch main &&
  git pull --ff-only origin main &&
  git log -1 --oneline &&
  sudo docker compose -p brainage-prod -f compose.prod.yaml config --quiet &&
  sudo docker compose -p brainage-prod -f compose.prod.yaml build
```

确认构建成功后再进入下一步。遇到 Git 冲突或构建失败时，旧容器仍可提供服务。如果 Docker Hub 拉取超时，在确认代码拉取和配置检查成功后，使用初次部署第 3 步的 ECR 构建命令。

### 3. 替换容器并验收

```bash
cd ~/brain-age
sudo docker compose -p brainage-prod -f compose.prod.yaml up -d --no-build --pull never --wait --wait-timeout 120 &&
  sudo docker compose -p brainage-prod -f compose.prod.yaml ps &&
  curl -fsS http://127.0.0.1:8080/healthz &&
  curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8080/
```

Compose 会根据新镜像重建服务容器。直接执行 `docker compose restart` 只会重启现有容器，仍使用原镜像。看到容器为 healthy、健康端点返回 ok、首页返回 200 后，用部署时选定的 SSH 隧道或受信任的 HTTPS 地址打开页面并确认核心流程。

### 4. 更新失败时回滚

如果构建失败，停在第 2 步并修复后重试。如果替换后容器不健康或页面异常，先查看日志，再恢复旧镜像。

```bash
cd ~/brain-age
sudo docker compose -p brainage-prod -f compose.prod.yaml logs --tail=100 web
sudo docker image tag brainage-prod-web:previous brainage-prod-web:latest &&
  sudo docker compose -p brainage-prod -f compose.prod.yaml up -d --no-build --pull never --force-recreate --wait --wait-timeout 120 &&
  curl -fsS http://127.0.0.1:8080/healthz
```

以上回滚恢复镜像。若本次发布也改了 Compose 配置，回滚时应使用第 1 步记录的旧提交中的配置，保持同一个 Compose 项目名。

### 5. 主动停机与恢复

计划维护时可手动停止服务。日常更新按前面的构建和替换步骤操作即可。

```bash
cd ~/brain-age
sudo docker compose -p brainage-prod -f compose.prod.yaml stop web
sudo docker compose -p brainage-prod -f compose.prod.yaml start web
```

执行过 `down` 后，使用第 3 步的 `up` 命令恢复容器。
