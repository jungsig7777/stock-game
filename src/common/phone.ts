/** 010-1234-5678, 01012345678, +82 10 1234 5678 등을 '01012345678' 형태로 통일 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('82')) return '0' + digits.slice(2);
  return digits;
}
