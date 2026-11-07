const SENSITIVE_KEYS = ['password', 'passwordHash', 'telegramToken', 'refreshToken', 'accessToken'];

export function sanitizeForAudit(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;
  const clone: Record<string, unknown> = { ...(body as Record<string, unknown>) };
  for (const key of SENSITIVE_KEYS) {
    if (key in clone) clone[key] = '[REDACTED]';
  }
  return clone;
}
