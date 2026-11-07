import { Tier } from '@prisma/client';
import { IsEnum, IsNumber, IsString } from 'class-validator';

export class SubmitPredictionDto {
  @IsString()
  gameId: string;

  @IsEnum(Tier)
  tier: Tier;

  // 예: 상단계는 0.2% 단위 슬라이더 값, 하/중단계는 칩으로 고른 값
  @IsNumber()
  predictedPct: number;

  // 투자 포인트는 더 이상 사용자가 고르지 않음 — 난이도별 고정값(TierConfig.fixedStake)을
  // 서버가 그대로 적용한다. 클라이언트가 값을 보내더라도 무시된다.
}
