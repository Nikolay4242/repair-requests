FROM node:18-alpine AS development

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN mkdir -p /app/data && chmod 777 /app/data

EXPOSE 3001

FROM node:18-alpine AS production

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
COPY --from=development /app/data /app/data

RUN npm run build

EXPOSE 3001

CMD ["node", "dist/main"]
