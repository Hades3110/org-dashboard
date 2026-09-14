# Build context is the repo root (see docker-compose.yml) — npm workspaces
# needs every workspace's package.json present to resolve `npm ci`, even
# when building an image for just one of them.
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY client/package.json client/package.json
RUN npm ci
COPY server server
RUN npm run build -w server

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/server/package.json server/package.json
COPY --from=build /app/server/dist server/dist
EXPOSE 3001
CMD ["node", "server/dist/index.js"]
