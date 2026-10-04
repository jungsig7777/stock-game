import { Tier } from '@prisma/client';
import { IsEnum, IsInt, Min } from 'class-validator';

export class AddBonusDto {
  @IsEnum(Tier)
  tier: Tier;

  @IsInt()
  @Min(1)
  amount: number;
}
