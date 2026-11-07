import { kstDateOf, kstTime } from './date-kst';

/**
 * 게임 일정 규칙 (한 곳에서만 정의 — 바꾸고 싶으면 여기만 수정)
 *
 *  - 정산일(settleDate): 유저가 맞히는 "종가 등락률"의 기준 날짜
 *  - 정산 시각: 정산일 18:30 (KST) — 하루 1회, 토스증권 API로 그날 확정 종가를 가져와 자동 정산
 *  - 베팅 마감: 정산일 00:00 (KST) — 즉, 유저는 정산일 "전날까지"만 예측 가능
 *    (정산일 장중에 가격이 움직이는 걸 보고 베팅할 수 없게 막는다)
 *
 * DB 스키마를 바꾸지 않으려고 Game.deadlineAt 에는 "베팅 마감 시각"을 저장하고,
 * 정산일은 deadlineAt 의 한국 날짜로 계산한다. (기존 게임은 deadlineAt=정산일 15:35 였는데,
 * 이 경우에도 한국 날짜는 정산일과 같아서 그대로 호환된다)
 */
export const SETTLE_HOUR_KST = 18;
export const SETTLE_MINUTE_KST = 30;
export const SETTLE_CRON = `${SETTLE_MINUTE_KST} ${SETTLE_HOUR_KST} * * *`;
export const SETTLE_RETRY_CRON = `${SETTLE_MINUTE_KST} ${SETTLE_HOUR_KST + 1} * * *`; // 1시간 뒤: 실패분만 재확인

/** 정산일 → 베팅 마감 시각(정산일 00:00 KST) */
export function bettingCutoffFor(settleDate: string): Date {
  return kstTime(settleDate, 0, 0);
}

/** 게임(deadlineAt) → 정산일 'YYYY-MM-DD' */
export function settleDateOf(deadlineAt: Date): string {
  return kstDateOf(deadlineAt);
}

/** 게임(deadlineAt) → 정산 시각(정산일 18:30 KST) */
export function settleAtOf(deadlineAt: Date): Date {
  return kstTime(settleDateOf(deadlineAt), SETTLE_HOUR_KST, SETTLE_MINUTE_KST);
}
