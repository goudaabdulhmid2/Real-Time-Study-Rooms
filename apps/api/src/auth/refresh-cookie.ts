/** Read the parsed refresh cookie without exposing its value to logs. */
export function getPresentedRefreshToken(
  cookies: Record<string, unknown> | undefined,
  cookieName = 'refresh_token',
): string | undefined {
  const token = cookies?.[cookieName];

  return typeof token === 'string' && token.length > 0
    ? token
    : undefined;
}
