// Quando o segredo não está configurado, libera dev/polling
export function isWebhookAuthorized(
  headerToken: string | undefined,
  secret: string | undefined
): boolean {
  if (!secret) return true;
  return headerToken === secret;
}

export function isCronAuthorized(
  authHeader: string | undefined,
  secret: string | undefined
): boolean {
  if (!secret) return true;
  return authHeader === `Bearer ${secret}`;
}
