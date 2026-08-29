export function bearerFrom(request: Request) {
  return (
    request.headers.get("x-api-key") ??
    request.headers.get("x-n8n-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    ""
  );
}

export function studioKeyOk(
  request: Request,
  studio: { apiKey: string; n8nSecret: string },
) {
  const given = bearerFrom(request);
  if (!given) return false;
  return (studio.apiKey && given === studio.apiKey) || (studio.n8nSecret && given === studio.n8nSecret);
}
