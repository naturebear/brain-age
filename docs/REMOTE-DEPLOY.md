# BrainAge 远程服务器部署

本文以一台有 sudo 权限的 Ubuntu 24.04 服务器为例。将命令中的 ubuntu、SERVER_IP 和 brainage.example.com 换成你的 SSH 用户、服务器地址和实际域名。服务器构建阶段需要访问 GitHub、镜像仓库和 npm 仓库。Node 在 Docker 构建阶段运行，服务器可直接用 Docker 部署。

## 1. 登录服务器并拉取代码

在本机终端登录，然后在服务器安装 Git。

```bash
ssh ubuntu@SERVER_IP
sudo apt update
sudo apt install -y git curl ca-certificates
```

如果仓库公开，直接克隆。

```bash
git clone --branch main https://github.com/naturebear/brain-age.git ~/brain-age
```

如果仓库私有，在服务器为该仓库生成专用密钥。密钥文件已存在时，选择另一个文件名并同步修改后续命令。

```bash
ssh-keygen -t ed25519 -f ~/.ssh/brainage_deploy -C brainage-server
cat ~/.ssh/brainage_deploy.pub
```

在 GitHub 仓库的 **Settings → Deploy keys → Add deploy key** 粘贴公钥，保持默认只读。第一次 SSH 连接时，核对 GitHub 公布的主机指纹。私钥留在服务器。为该克隆保存专用 SSH 命令，后续拉取沿用它。[GitHub Deploy keys](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys) · [GitHub SSH 指纹](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints)

```bash
git clone --branch main -c core.sshCommand="ssh -i $HOME/.ssh/brainage_deploy -o IdentitiesOnly=yes" git@github.com:naturebear/brain-age.git ~/brain-age
```

两种方式任选其一。进入仓库确认当前提交。

```bash
cd ~/brain-age
git log -1 --oneline
```

## 2. 安装 Docker Engine、Buildx 和 Compose

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

## 3. 构建并启动生产容器

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

若 Docker Hub 拉取令牌超时，可使用 Docker 在 Amazon ECR Public 发布的同版本基础镜像。以下命令通过标准输入替换构建时的镜像地址，产物名匹配 Compose 项目默认镜像名。完成后执行上面的 up 和检查命令。[Docker 的 ECR Public 镜像仓库](https://gallery.ecr.aws/docker/)

```bash
cd ~/brain-age
sed -E 's@^FROM (node:|nginx:)@FROM public.ecr.aws/docker/library/\1@' apps/web/Dockerfile |
  sudo docker build --target production -t brainage-prod-web:latest -f - .
```

若服务器也无法访问 npm，可在网络可达、CPU 架构匹配的机器构建同名镜像，用 `docker image save -o brainage-prod-web.tar brainage-prod-web:latest` 导出，传到服务器后用 `sudo docker image load -i brainage-prod-web.tar` 导入，再执行第 3 节的 up 命令并追加 `--pull never`。

## 4. 浏览器访问

**先私下验收。** 在本机另开终端，建立 SSH 转发并保持终端开启。浏览器打开 http://127.0.0.1:18080/。

```bash
ssh -N -L 127.0.0.1:18080:127.0.0.1:8080 ubuntu@SERVER_IP
```

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

## 5. 日志、升级和回滚

```bash
cd ~/brain-age
sudo docker compose -p brainage-prod -f compose.prod.yaml logs --tail=100 web
sudo docker compose -p brainage-prod -f compose.prod.yaml ps
```

升级前为当前镜像打回滚标签，再拉取 main 和重建。若使用 ECR，则以第 3 节的 ECR 构建命令替换下面的 build。

```bash
sudo docker image tag brainage-prod-web:latest brainage-prod-web:previous
git pull --ff-only origin main
sudo docker compose -p brainage-prod -f compose.prod.yaml build
sudo docker compose -p brainage-prod -f compose.prod.yaml up -d --no-build --wait --wait-timeout 120
curl -fsS http://127.0.0.1:8080/healthz
```

若升级后需回滚，恢复上一镜像并重建运行容器。

```bash
sudo docker image tag brainage-prod-web:previous brainage-prod-web:latest
sudo docker compose -p brainage-prod -f compose.prod.yaml up -d --no-build --pull never --force-recreate --wait --wait-timeout 120
```

停止服务时运行 `sudo docker compose -p brainage-prod -f compose.prod.yaml down`。若域名访问失败，先从服务器检查回环地址的健康端点，再检查反向代理日志和 DNS。
