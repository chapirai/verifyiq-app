FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

FROM deps AS build
# tsconfig.json extends "../tsconfig.base.json"; from WORKDIR /app that resolves to /tsconfig.base.json
COPY tsconfig.base.json /tsconfig.base.json
COPY frontend/tsconfig.json frontend/next.config.js frontend/postcss.config.js frontend/tailwind.config.ts frontend/components.json ./
COPY frontend/src ./src
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY frontend/package.json ./
EXPOSE 3000
CMD ["npm", "run", "start"]
