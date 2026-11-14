# Production web image: the Vite build served by nginx. Build from the root:
#   docker build -f apps/web/Dockerfile -t dwc-web .
# In Kubernetes the Ingress routes /api and /socket.io straight to the API
# (with sticky sessions), so nginx only serves the single-page app.
FROM node:24.19.0-bookworm-slim AS build
WORKDIR /workspace
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/web/package.json apps/web/
COPY packages/realtime-contracts/package.json packages/realtime-contracts/
RUN pnpm install --frozen-lockfile --filter @dwc/web...
COPY packages/realtime-contracts packages/realtime-contracts
COPY apps/web apps/web
RUN pnpm --filter @dwc/web build

FROM nginx:1.29-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
