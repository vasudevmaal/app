const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

function parseOrigin(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return {
      protocol: url.protocol,
      hostname: url.hostname.toLowerCase(),
      port: url.port || (url.protocol === 'https:' ? '443' : '80'),
      origin: url.origin.toLowerCase(),
    };
  } catch {
    return null;
  }
}

function originFromHost(host: string | null | undefined, protocol: string) {
  if (!host) return null;
  const trimmed = host.trim();
  if (!trimmed || /[/?#\\]/.test(trimmed)) return null;
  return parseOrigin(`${protocol}//${trimmed}`);
}

function isLoopback(hostname: string) {
  return LOOPBACK_HOSTS.has(hostname.toLowerCase());
}

export function isAllowedRequestOrigin(
  originHeader: string | null,
  requestUrl: string,
  appUrl?: string,
  hostHeader?: string | null,
) {
  if (!originHeader) return true;

  const origin = parseOrigin(originHeader);
  const requestOrigin = parseOrigin(requestUrl);
  if (!origin || !requestOrigin) return false;

  const allowed = [
    requestOrigin,
    parseOrigin(appUrl),
    originFromHost(hostHeader, requestOrigin.protocol),
  ].filter(Boolean) as NonNullable<ReturnType<typeof parseOrigin>>[];

  if (allowed.some((item) => item.origin === origin.origin)) return true;

  return allowed.some(
    (item) =>
      item.protocol === origin.protocol &&
      item.port === origin.port &&
      isLoopback(item.hostname) &&
      isLoopback(origin.hostname),
  );
}
