/**
 * Limitador de tasa fijo por ventana, sin dependencias.
 *
 * El estado vive en memoria del proceso (Map a nivel de módulo en quien lo instancia),
 * por lo que es por-instancia-tibia en Vercel Fluid Compute: suficiente como freno ante
 * abuso/accidente en endpoints admin de bajo tráfico, no como límite distribuido fuerte.
 * Si se necesita durabilidad entre instancias, migrar a Upstash Redis (ver plan).
 */
export type RateLimitResult = { allowed: boolean; retryAfterMs: number };

export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
  const hits = new Map<string, { count: number; windowStart: number }>();

  return {
    check(key: string, now: number = Date.now()): RateLimitResult {
      const entry = hits.get(key);
      if (!entry || now - entry.windowStart >= windowMs) {
        hits.set(key, { count: 1, windowStart: now });
        return { allowed: true, retryAfterMs: 0 };
      }
      if (entry.count < limit) {
        entry.count += 1;
        return { allowed: true, retryAfterMs: 0 };
      }
      return { allowed: false, retryAfterMs: entry.windowStart + windowMs - now };
    }
  };
}
