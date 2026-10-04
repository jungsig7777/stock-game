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

  // 관리자는 시각이 아니라 '정산할 날짜'만 지정한다 (예: 2026-08-30).
  // 실제 마감/정산 시각은 그 날짜의 한국 증시 마감(15:30 KST) 직후로 서버가 자동 계산한다.
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '날짜는 YYYY-MM-DD 형식이어야 합니다' })
  settleDate: string;
}
