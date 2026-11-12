FROM node:22.22.0-bookworm-slim AS dev
WORKDIR /app
COPY apps/web/package*.json ./
RUN npm ci
COPY apps/web/ ./
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

FROM dev AS build
RUN npm run build

FROM nginx:1.28.2-alpine AS production
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/ /usr/share/nginx/html/
