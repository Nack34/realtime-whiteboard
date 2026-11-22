# 1) Build the React client
FROM node:22-alpine AS client
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client ./
COPY shared /app/shared
RUN npm run build

# 2) Build the Socket.IO server
FROM node:22-alpine AS server
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server ./
COPY shared /app/shared
RUN npm run build

# 3) Runtime: one Node process serves the API, the websocket and the static client
FROM node:22-alpine
WORKDIR /app/server
ENV NODE_ENV=production STATIC_DIR=/app/public PORT=3000
COPY server/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=server /app/server/dist ./dist
COPY --from=client /app/client/dist /app/public
USER node
EXPOSE 3000
CMD ["node", "dist/server/src/index.js"]
