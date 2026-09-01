import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // 1) 난이도 기준값 (프로토타입과 동일한 기본값: 하 1%/±6, 중 0.5%/±6, 상 0.2%/±6)
  // 난이도별 예측 단위/범위 + 1회당 고정 투자 포인트 (초급 150 / 중급 100 / 상급 50)
  await prisma.tierConfig.upsert({
    where: { tier: 'LOW' },
    update: { fixedStake: 150 },
    create: { tier: 'LOW', stepPct: 1, maxPct: 6, fixedStake: 150 },
  });
  await prisma.tierConfig.upsert({
    where: { tier: 'MID' },
    update: { fixedStake: 100 },
    create: { tier: 'MID', stepPct: 0.5, maxPct: 6, fixedStake: 100 },
  });
  await prisma.tierConfig.upsert({
    where: { tier: 'HIGH' },
    update: { fixedStake: 50 },
    create: { tier: 'HIGH', stepPct: 0.2, maxPct: 6, fixedStake: 50 },
  });

  // 2) 이월 포인트 풀 초기화
  for (const tier of ['LOW', 'MID', 'HIGH'] as const) {
    await prisma.carryoverPot.upsert({
      where: { tier },
      update: {},
      create: { tier, points: 0 },
    });
  }

  // 3) 종목 (한국/해외)
  // 한국 증시(코스피·코스닥) 중심으로 구성 - 시가총액 상위 + 업종 대표주 위주
  // market 필드는 프런트엔드 원화 표시 로직과 맞추기 위해 그대로 'KR' 사용
  const stocks = [
    { market: 'KR', name: '삼성전자', code: '005930' },
    { market: 'KR', name: 'SK하이닉스', code: '000660' },
    { market: 'KR', name: 'NAVER', code: '035420' },
    { market: 'KR', name: '카카오', code: '035720' },
    { market: 'KR', name: 'LG에너지솔루션', code: '373220' },
    { market: 'KR', name: '현대차', code: '005380' },
    { market: 'KR', name: '기아', code: '000270' },
    { market: 'KR', name: 'POSCO홀딩스', code: '005490' },
    { market: 'KR', name: '삼성바이오로직스', code: '207940' },
    { market: 'KR', name: '셀트리온', code: '068270' },
    { market: 'KR', name: 'KB금융', code: '105560' },
    { market: 'KR', name: '신한지주', code: '055550' },
    { market: 'KR', name: '에코프로비엠', code: '247540' },
    { market: 'KR', name: '알테오젠', code: '196170' },
    { market: 'KR', name: '에코프로', code: '086520' },
  ];
  for (const s of stocks) {
    const existing = await prisma.stock.findFirst({ where: { code: s.code } });
    if (!existing) await prisma.stock.create({ data: s });
  }

  // 4) 관리자 테스트 계정 (실서비스 배포 전 비밀번호 반드시 교체)
  const adminEmail = 'admin@test.com';
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('jungho9250', 10);
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        name: '관리자',
        nickname: 'Admin',
        role: 'ADMIN',
        referralCode: 'ADMINCODE',
        privacyConsentedAt: new Date(),
        points: 0,
      },
    });
    console.log(`✅ 관리자 계정 생성: ${adminEmail} / jungho9250`);
  }

  // 5) 쿠폰 샘플 (테스트용 - 만료임박 알림 기능도 바로 확인 가능하도록 하나는 30일 이내로 설정)
  const couponSamples = [
    { name: '스타벅스 아메리카노', emoji: '☕', costPoints: 500, code: 'SBUX-2026-A1B2', stockQty: 24, days: 23 },
    { name: 'CGV 영화관람권', emoji: '🎬', costPoints: 1200, code: 'CGV-VIP-7788', stockQty: 10, days: 150 },
    { name: 'GS25 편의점 3천원권', emoji: '🏪', costPoints: 450, code: 'GS25-3000-QW77', stockQty: 40, days: 18 },
  ];
  for (const c of couponSamples) {
    const existing = await prisma.coupon.findFirst({ where: { code: c.code } });
    if (!existing) {
      await prisma.coupon.create({
        data: {
          name: c.name,
          emoji: c.emoji,
          costPoints: c.costPoints,
          code: c.code,
          stockQty: c.stockQty,
          expiryDate: new Date(Date.now() + c.days * 86400000),
        },
      });
    }
  }

  console.log('✅ 시드 완료');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
