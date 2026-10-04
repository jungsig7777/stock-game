import { IsInt, IsString, MinLength, NotEquals } from 'class-validator';

export class AdjustPointsDto {
  // 양수면 지급, 음수면 회수(어뷰징 의심 등). 0은 의미가 없어 허용하지 않음
  @IsInt()
  @NotEquals(0, { message: '조정 포인트는 0이 될 수 없습니다' })
  delta: number;

  @IsString()
  @MinLength(2, { message: '사유를 입력해주세요' })
  reason: string;
}
