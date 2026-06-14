import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// session.ts importa next/headers (cookies) a nivel de módulo; lo aislamos para poder
// probar el helper puro getSessionTtlMs en entorno node sin contexto de request.
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

import { getSessionTtlMs } from "@/lib/session";

const HOUR = 60 * 60 * 1000;

describe("getSessionTtlMs", () => {
  const original = process.env.SESSION_TTL_HOURS;

  beforeEach(() => {
    delete process.env.SESSION_TTL_HOURS;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.SESSION_TTL_HOURS;
    else process.env.SESSION_TTL_HOURS = original;
  });

  it("usa 12 h por defecto cuando no hay env", () => {
    expect(getSessionTtlMs()).toBe(12 * HOUR);
  });

  it("respeta un valor valido del env", () => {
    process.env.SESSION_TTL_HOURS = "8";
    expect(getSessionTtlMs()).toBe(8 * HOUR);
  });

  it("acota al rango 1-24 h", () => {
    process.env.SESSION_TTL_HOURS = "48";
    expect(getSessionTtlMs()).toBe(24 * HOUR);
    process.env.SESSION_TTL_HOURS = "0.25";
    expect(getSessionTtlMs()).toBe(1 * HOUR);
  });

  it("cae al default ante valores invalidos", () => {
    process.env.SESSION_TTL_HOURS = "abc";
    expect(getSessionTtlMs()).toBe(12 * HOUR);
    process.env.SESSION_TTL_HOURS = "-5";
    expect(getSessionTtlMs()).toBe(12 * HOUR);
  });
});
