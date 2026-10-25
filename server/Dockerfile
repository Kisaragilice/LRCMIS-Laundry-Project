# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY client/package.json ./client/package.json
RUN npm ci

COPY server ./server
RUN npx prisma generate --schema server/prisma/schema.prisma
RUN npm run build -w server

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY client/package.json ./client/package.json
RUN npm ci

COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=build /app/server/dist ./server/dist
COPY server/prisma ./server/prisma
COPY server/docker-entrypoint.sh ./server/docker-entrypoint.sh
RUN chmod +x ./server/docker-entrypoint.sh

WORKDIR /app/server
EXPOSE 4000
ENTRYPOINT ["sh", "./docker-entrypoint.sh"]
