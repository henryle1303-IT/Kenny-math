# Production image: SQLite lives on a mounted volume (/data).
FROM node:22-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production DATABASE_URL=file:/data/kenny.db PORT=3000
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY --from=build /app ./
VOLUME /data
EXPOSE 3000
# Apply migrations, seed on first start (Kenny, the admin and the first 900-question bank), then serve.
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/seed.ts && npx next start -p ${PORT}"]
