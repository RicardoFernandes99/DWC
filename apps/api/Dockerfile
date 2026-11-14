# Production API image. Build from the repository root:
#   docker build -f apps/api/Dockerfile -t dwc-api .
FROM node:24.19.0-bookworm-slim AS build
WORKDIR /workspace
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY packages/realtime-contracts/package.json packages/realtime-contracts/
RUN pnpm install --frozen-lockfile --filter @dwc/api...
COPY packages/realtime-contracts packages/realtime-contracts
COPY apps/api apps/api
RUN pnpm --filter @dwc/api build \
  && pnpm --filter @dwc/api deploy --prod --legacy /out \
  && cp -r apps/api/dist apps/api/scripts apps/api/fixtures /out/

FROM node:24.19.0-bookworm-slim
ENV NODE_ENV=production \
  API_HOST=0.0.0.0 \
  API_PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 3000
# Liveness for plain Docker; Kubernetes uses its own probes.
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.API_PORT||3000)+'/api/health/live').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "dist/main.js"]
