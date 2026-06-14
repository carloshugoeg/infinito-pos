import { describe, expect, it } from "vitest";
import { createRateLimiter } from "@/lib/rate-limit";

describe("createRateLimiter", () => {
  it("permite hasta el limite y luego bloquea dentro de la ventana", () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 1000 });
    expect(limiter.check("user-1", 0).allowed).toBe(true);
    expect(limiter.check("user-1", 100).allowed).toBe(true);
    expect(limiter.check("user-1", 200).allowed).toBe(true);

    const blocked = limiter.check("user-1", 300);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBe(700); // 0 + 1000 - 300
  });

  it("reinicia el conteo cuando expira la ventana", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect(limiter.check("user-1", 0).allowed).toBe(true);
    expect(limiter.check("user-1", 500).allowed).toBe(false);
    expect(limiter.check("user-1", 1000).allowed).toBe(true);
  });

  it("rastrea cada clave de forma independiente", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect(limiter.check("user-1", 0).allowed).toBe(true);
    expect(limiter.check("user-2", 0).allowed).toBe(true);
    expect(limiter.check("user-1", 0).allowed).toBe(false);
  });
});
