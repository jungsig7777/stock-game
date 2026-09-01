import { IsNumber, Max, Min } from 'class-validator';

export class SettleGameDto {
  // 3단계에서 실시세 API를 연동하면 이 값은 배치가 공식 종가로부터 자동 계산해서 넣게 됩니다.
  // 그 전까지는 관리자가 확정된 등락률을 직접 입력해 정산을 트리거합니다.
  @IsNumber()
  @Min(-100)
  @Max(100)
  actualPct: number;
}
