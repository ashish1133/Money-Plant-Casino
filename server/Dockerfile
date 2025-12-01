# Lucky Casino Dockerfile
FROM node:20-alpine AS base
WORKDIR /app
COPY server/package.json server/package-lock.json ./server/

WORKDIR /app/server
RUN npm ci --only=production

# Copy server source
COPY server/. .
# Copy frontend static assets
WORKDIR /app
COPY index.html styles.css script.js api-client.js ./

# Runtime image
FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=base /app /app
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server/server.js"]
