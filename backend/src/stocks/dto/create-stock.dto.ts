import { IsString, Length, Matches } from 'class-validator';

export class CreateStockDto {
  @IsString()
  @Length(1, 10, { message: '시장 구분을 입력하세요 (예: KR)' })
  market: string;

  @IsString()
  @Length(1, 50)
  name: string;

  @IsString()
  @Matches(/^[0-9A-Za-z.]{1,10}$/, { message: '종목코드 형식이 올바르지 않아요' })
  code: string;
}
