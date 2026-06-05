# wunan API image. Build from the repository root:
#   docker build -f apps/api/Dockerfile .
# Node runs the TypeScript sources directly (type stripping), so there is no build step;
# only production dependencies are installed.

FROM node:24.14.1-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev --workspace @wunan/api --include-workspace-root=false \
  && npm cache clean --force

FROM node:24.14.1-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
# All installed packages, including any npm placed inside a workspace's own node_modules.
COPY --from=deps /app ./
COPY packages/shared/src packages/shared/src
COPY apps/api/src apps/api/src
COPY apps/api/scripts apps/api/scripts
COPY apps/api/drizzle apps/api/drizzle
# Photos live on a volume mounted here; it must belong to the unprivileged user.
RUN mkdir -p /data/photos && chown node:node /data/photos
USER node
WORKDIR /app/apps/api
ENV PHOTOS_DIR=/data/photos API_PORT=3000
EXPOSE 3000
CMD ["node", "src/index.ts"]
