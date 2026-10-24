# syntax=docker/dockerfile:1
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY public ./public
COPY src ./src
COPY scripts/build.mjs ./scripts/build.mjs

ARG APP_VERSION=local
ARG COMMIT_SHA=development
ENV APP_VERSION=${APP_VERSION}
ENV COMMIT_SHA=${COMMIT_SHA}
RUN npm run build

FROM node:22-alpine AS runtime

ARG APP_VERSION=local
ARG COMMIT_SHA=development

LABEL org.opencontainers.image.title="CI/CD Task Board" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.revision="${COMMIT_SHA}"

ENV NODE_ENV=production \
    PORT=3000 \
    APP_VERSION=${APP_VERSION} \
    COMMIT_SHA=${COMMIT_SHA}

WORKDIR /app
COPY --from=build --chown=node:node /app/dist ./dist

USER node
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

CMD ["node", "dist/src/server.mjs"]
