# Build from repository root: docker compose uses context: . with this file.
FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY backend/package.json backend/package-lock.json ./
RUN npm ci

FROM deps AS build
COPY tsconfig.base.json /tsconfig.base.json
COPY backend/tsconfig.json backend/tsconfig.build.json backend/nest-cli.json ./
COPY backend/src ./src
COPY backend/migrations ./migrations
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Arelle iXBRL extract runs in a subprocess (see AnnualReportArelleService).
RUN apk add --no-cache python3 py3-pip
COPY backend/requirements-arelle.txt ./requirements-arelle.txt
COPY backend/tools ./tools
RUN python3 -m venv /opt/venv \
  && /opt/venv/bin/pip install --no-cache-dir --upgrade pip \
  && /opt/venv/bin/pip install --no-cache-dir -r requirements-arelle.txt
ENV PATH="/opt/venv/bin:${PATH}"
ENV ARELLE_PYTHON=/opt/venv/bin/python3
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY backend/package.json ./package.json
COPY backend/migrations ./migrations
COPY backend/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh \
  && chmod +x /usr/local/bin/docker-entrypoint.sh
EXPOSE 4000
ENTRYPOINT ["/bin/sh", "/usr/local/bin/docker-entrypoint.sh"]
