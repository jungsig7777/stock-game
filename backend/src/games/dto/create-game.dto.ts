import { Tier } from '@prisma/client';
import { ArrayNotEmpty, IsArray, IsEnum, IsInt, IsString, Matches, Min } from 'class-validator';

export class CreateGameDto {
  @IsString()
  stockId: string;

  @IsArray()
  @ArrayNotEmpty({ message: '난이도를 1개 이상 선택하세요' })
  @IsEnum(Tier, { each: true })
  tiers: Tier[];

  @IsInt()
  @Min(0)
  seedPoints: number;

  // 관리자는 '정산할 날짜'만 지정한다 (예: 2026-09-14, 내일 이후의 평일).
  // 유저는 그 전날까지 예측하고, 서버가 정산일 18:30(KST)에 토스증권 확정 종가로 자동 정산한다.
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '날짜는 YYYY-MM-DD 형식이어야 합니다' })
  settleDate: string;
}
