FROM node:18-alpine AS build

WORKDIR /app/client

COPY client/package.json client/package-lock.json ./
RUN npm ci --legacy-peer-deps

COPY client/ ./
RUN npm run build

FROM nginx:1.27-alpine

COPY client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/client/dist/client/browser /usr/share/nginx/html

EXPOSE 80
