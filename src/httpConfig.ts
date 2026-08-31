export const DEFAULT_HOST = '127.0.0.1';
export const DEFAULT_PORT = 3000;

export function getConfiguredHost(): string {
  const host = process.env.HOST?.trim();
  return host && host.length > 0 ? host : DEFAULT_HOST;
}

export function getConfiguredPort(): number {
  const configuredPort = Number.parseInt(process.env.PORT ?? String(DEFAULT_PORT), 10);

  return Number.isInteger(configuredPort) &&
    configuredPort > 0 &&
    configuredPort <= 65_535
    ? configuredPort
    : DEFAULT_PORT;
}

export function getAllowedHosts(): string[] {
  const base = ['localhost', '127.0.0.1', '[::1]'];
  const configuredHost = getConfiguredHost();
  if (configuredHost && !base.includes(configuredHost)) {
    base.push(configuredHost);
  }

  const envHosts = process.env.ALLOWED_HOSTS?.split(',').map((h) => h.trim()).filter(Boolean);
  if (envHosts && envHosts.length > 0) {
    for (const h of envHosts) {
      if (!base.includes(h)) {
        base.push(h);
      }
    }
  }

  return base;
}

export function getAllowedOrigins(): string[] {
  const base = ['localhost', '127.0.0.1', '[::1]'];
  const configuredHost = getConfiguredHost();
  if (configuredHost && !base.includes(configuredHost)) {
    base.push(configuredHost);
  }

  const envOrigins = process.env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean);
  if (envOrigins && envOrigins.length > 0) {
    for (const o of envOrigins) {
      if (!base.includes(o)) {
        base.push(o);
      }
    }
  }

  return base;
}

/**
 * Backward compatibility alias for development default host
 */
export const LOCAL_HOST = DEFAULT_HOST;
