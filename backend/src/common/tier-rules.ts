export type TierName = 'LOW' | 'MID' | 'HIGH';

export interface TierBounds {
  stepPct: number;
  maxPct: number;
}

/**
 * 예측값(predicted)이 실제 등락률(actual) 대비 적중인지 판정한다.
 *
 * 구간 방식: predicted 값은 항상 "그 구간의 상한"을 의미한다.
 * 예) 하단계에서 +1% 를 선택하면 적중 구간은 (0%, +1%] — 0% 초과 1% 이하.
 *     +2% 를 선택하면 (+1%, +2%] 구간. 최상단 버킷(예: +6%)은 상한이 없어
 *     (+5%, +∞) 구간이 된다. 음수도 동일한 방식으로 대칭 적용.
 *
 * 0%(보합)는 어떤 구간에도 포함되지 않는다 — 즉 actual 이 정확히 0%면
 * 그 어떤 예측도 적중하지 않으며, 게임 정산 로직(GamesService.settle)이
 * 자동으로 해당 회차 전액을 다음 회차로 이월 처리한다 (별도 분기 불필요).
 */
export function isWin(tier: TierName, predicted: number, actual: number, bounds: TierBounds): boolean {
  if (actual === 0 || predicted === 0) return false;
  if (Math.sign(actual) !== Math.sign(predicted)) return false;

  const step = bounds.stepPct;
  const max = bounds.maxPct;
  const magPredicted = Math.abs(predicted);
  const magActual = Math.abs(actual);

  const lower = Math.round((magPredicted - step) * 100) / 100; // 구간 하한 (초과 기준, 미포함)
  const isTopBucket = magPredicted >= max - 1e-9;

  if (isTopBucket) {
    // 최상단 버킷: 하한 초과면 상한 없이 전부 적중 (예: +6% 초과 전부)
    return magActual > Math.max(lower, 0);
  }
  return magActual > Math.max(lower, 0) && magActual <= magPredicted + 1e-9;
}

/** 사용자에게 "이 선택지가 적중하는 범위"를 보여주기 위한 하한/상한 계산 (표시용) */
export function winRange(predicted: number, bounds: TierBounds): { lower: number; upper: number | null } {
  const step = bounds.stepPct;
  const max = bounds.maxPct;
  const magPredicted = Math.abs(predicted);
  const lower = Math.max(Math.round((magPredicted - step) * 100) / 100, 0);
  const isTopBucket = magPredicted >= max - 1e-9;
  return { lower, upper: isTopBucket ? null : magPredicted };
}
