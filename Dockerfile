# ---- 빌드 단계 ----
FROM node:20-slim AS build
WORKDIR /app

# Prisma 엔진이 libssl 을 필요로 함 (slim 이미지엔 기본 미포함)
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

# ---- 실행 단계 (빌드 산출물만 옮겨서 이미지 용량 최소화) ----
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 4000

# 컨테이너가 뜰 때마다 아직 적용 안 된 마이그레이션을 자동으로 적용한 뒤 서버를 기동.
# Render/Fly.io 처럼 "빌드 후 바로 실행"만 지원하는 무료 호스팅에서 별도 스텝 없이 배포되도록 하기 위함.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
