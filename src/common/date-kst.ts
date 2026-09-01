/** 오늘 날짜를 'YYYY-MM-DD' (KST 기준)로 반환 */
export function todayKST(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

/** 주어진 날짜가 속한 주(월~일)의 날짜 7개를 'YYYY-MM-DD'로 반환 */
export function getWeekDatesKST(dateStr: string): string[] {
  const d = new Date(dateStr + 'T12:00:00Z'); // 정오 기준으로 경계 문제 방지
  const day = d.getUTCDay(); // 0=일 .. 6=토
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + mondayOffset);

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const x = new Date(monday);
    x.setUTCDate(monday.getUTCDate() + i);
    dates.push(x.toISOString().slice(0, 10));
  }
  return dates;
}

/** 이번 주를 구분하는 키 (월요일 날짜를 그대로 사용) */
export function getWeekKey(dateStr: string): string {
  return getWeekDatesKST(dateStr)[0];
}

/** 'YYYY-MM' 형태의 이번 달 키 */
export function getMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

/** 해당 'YYYY-MM' 달의 총 일수 */
export function daysInMonth(monthKey: string): number {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}
