FROM node:18-alpine

WORKDIR /app

COPY agente-bascula/package.json agente-bascula/package-lock.json ./
RUN npm ci --omit=dev

COPY agente-bascula/ ./

EXPOSE 3920

CMD ["node", "src/index.js"]
