# Brain Age

BrainAge Web 提供空间记忆与注意测评、个人记录、空间记忆训练和五分钟正念。

- [首版开发规格](docs/V1-DEVELOPMENT.md)
- [结果页交互参考](docs/radar-reference.html)
- Web 代码位于 apps/web，小程序目录留待后续开发。

## 本机运行

推荐使用与容器一致的 Node 22.22.0。

~~~sh
cd apps/web
npm ci
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
npm run preview
~~~

浏览器测试先运行 npx playwright install chromium，再运行 npm run test:e2e。已有 Edge 时可设置 BRAINAGE_BROWSER=msedge 运行。

## Docker

[本地容器构建与部署指南](docs/LOCAL-DOCKER.md)

[远程服务器部署指南](docs/REMOTE-DEPLOY.md)

Windows Docker Desktop 使用 Linux 容器。从仓库根目录运行。

~~~sh
docker compose -f compose.dev.yaml up --build
docker compose -f compose.prod.yaml up -d --build
docker compose -f compose.prod.yaml ps
docker compose -f compose.prod.yaml logs --tail=100 web
docker compose -f compose.prod.yaml down
~~~

开发地址为 http://localhost:5173。Windows 绑定挂载的热更新失效时，可设 BRAINAGE_WATCH_POLLING=true。局域网调试可设 BRAINAGE_DEV_BIND=0.0.0.0。手机上的部分浏览器能力要求 HTTPS，正式访问请使用稳定 HTTPS 域名。

生产容器通过 http://127.0.0.1:8080 提供静态站点，宿主机配置 HTTPS 反向代理指向该地址。健康检查路径为 /healthz。目标服务器需要 Docker Compose 和可用的镜像源；跨机器预构建时选择服务器的 Linux CPU 架构。发布时记录提交和镜像标签，保留上一可用标签以便回滚。

测评与训练记录保存在浏览器，同源访问可继续读取。更换域名、协议、端口或浏览器时使用不同存储空间。
