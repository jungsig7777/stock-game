import { IsNumber, Min } from 'class-validator';

export class UpdateTierConfigDto {
  @IsNumber()
  @Min(0.01, { message: '단위는 0보다 커야 합니다' })
  stepPct: number;

  @IsNumber()
  @Min(0.01, { message: '최대범위는 0보다 커야 합니다' })
  maxPct: number;
}
