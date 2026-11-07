import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateCouponDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  emoji?: string;

  @IsInt()
  @Min(1)
  costPoints: number;

  @IsString()
  code: string;

  @IsDateString()
  expiryDate: string;

  @IsInt()
  @Min(0)
  stockQty: number;
}
