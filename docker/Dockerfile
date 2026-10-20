# syntax=docker/dockerfile:1
# Two targets: app (Next standalone) and worker (jobs, with Chromium and poppler).
# Every base image and package here exists for amd64 and arm64 (Section K builds arm64).
ARG NODE_IMAGE=node:24.22.0-alpine3.24
ARG ALPINE_IMAGE=alpine:3.24.2

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM deps AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --prod

# The app runtime needs only the node binary, not npm or corepack: it keeps the image small.
FROM ${ALPINE_IMAGE} AS app
RUN apk add --no-cache libstdc++ \
  && addgroup -g 1000 node && adduser -u 1000 -G node -s /bin/sh -D node
COPY --from=base /usr/local/bin/node /usr/local/bin/node
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build --chown=node:node /repo/.next/standalone ./
COPY --from=build --chown=node:node /repo/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]

FROM ${NODE_IMAGE} AS worker
RUN apk add --no-cache chromium poppler-utils
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps --chown=node:node /repo/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node worker ./worker
COPY --chown=node:node src/platform ./src/platform
USER node
CMD ["node", "worker/index.ts"]
