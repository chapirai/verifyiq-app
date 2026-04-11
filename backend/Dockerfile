# Supports two build contexts:
# - Backend-only root (Coolify etc.): context = this `backend/` folder, default SRC_PREFIX empty.
# - Monorepo root (docker compose): context = repo root, pass build-arg SRC_PREFIX=backend/
#
# Example (from repo root): docker compose build backend
# Example (from backend/):   docker build -f Dockerfile .

ARG SRC_PREFIX=

FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
ARG SRC_PREFIX
COPY ${SRC_PREFIX}package.json ${SRC_PREFIX}package-lock.json ./
RUN npm ci

FROM deps AS build
ARG SRC_PREFIX
COPY ${SRC_PREFIX}tsconfig.base.json /tsconfig.base.json
COPY ${SRC_PREFIX}tsconfig.json ${SRC_PREFIX}tsconfig.build.json ${SRC_PREFIX}nest-cli.json ./
COPY ${SRC_PREFIX}src ./src
COPY ${SRC_PREFIX}migrations ./migrations
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ARG SRC_PREFIX
RUN apk add --no-cache python3 py3-pip
COPY ${SRC_PREFIX}requirements-arelle.txt ./requirements-arelle.txt
COPY ${SRC_PREFIX}tools ./tools
RUN python3 -m venv /opt/venv \
  && /opt/venv/bin/pip install --no-cache-dir --upgrade pip \
  && /opt/venv/bin/pip install --no-cache-dir -r requirements-arelle.txt
ENV PATH="/opt/venv/bin:${PATH}"
ENV ARELLE_PYTHON=/opt/venv/bin/python3
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY ${SRC_PREFIX}package.json ./package.json
COPY ${SRC_PREFIX}migrations ./migrations
COPY ${SRC_PREFIX}docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh \
  && chmod +x /usr/local/bin/docker-entrypoint.sh
EXPOSE 4000
ENTRYPOINT ["/bin/sh", "/usr/local/bin/docker-entrypoint.sh"]
