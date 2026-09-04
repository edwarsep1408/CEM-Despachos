FROM node:18-alpine AS build

WORKDIR /app/backend

COPY backend/package.json backend/package-lock.json ./
RUN npm ci

COPY backend/ ./
RUN npm run build

FROM node:18-alpine

WORKDIR /app/backend

ENV NODE_ENV=production

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/backend/dist ./dist
RUN mkdir -p tmp/files

EXPOSE 3020

CMD ["node", "dist/index.js"]
