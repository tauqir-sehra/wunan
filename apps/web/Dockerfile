# wunan web app image. Build from the repository root:
#   docker build -f apps/web/Dockerfile .
# The build bundles everything the server needs, so the final image has no node_modules.

FROM node:24.14.1-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace @wunan/web --include-workspace-root=false
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build -w apps/web

FROM node:24.14.1-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/apps/web/build ./build
COPY --from=build /app/apps/web/package.json ./package.json
USER node
ENV PORT=3000
EXPOSE 3000
CMD ["node", "build"]
