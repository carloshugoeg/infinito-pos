import { describe, expect, it } from "vitest";
import {
  formatGuatemalaDate,
  formatGuatemalaTime,
  guatemalaDateInput,
  guatemalaDayRange,
  guatemalaDayStart,
  guatemalaDayStartFromInput
} from "@/lib/time";

describe("time formatting", () => {
  it("formatea hora de Guatemala de forma estable para SSR e hidratacion", () => {
    expect(formatGuatemalaTime("2026-05-03T19:43:00.000Z")).toBe("01:43 p. m.");
    expect(formatGuatemalaTime("2026-05-03T07:05:00.000Z")).toBe("01:05 a. m.");
    expect(formatGuatemalaTime("2026-05-03T18:00:00.000Z")).toBe("12:00 p. m.");
  });
});

describe("Guatemala day helpers", () => {
  it("deriva la fecha de calendario de Guatemala (UTC-6)", () => {
    // El día NO cambia hasta las 00:00 de Guatemala (06:00 UTC).
    expect(guatemalaDateInput(new Date("2026-06-23T05:59:00.000Z"))).toBe("2026-06-22");
    expect(guatemalaDateInput(new Date("2026-06-23T06:00:00.000Z"))).toBe("2026-06-23");
  });

  it("ancla el inicio del día a las 06:00 UTC (00:00 de Guatemala)", () => {
    expect(guatemalaDayStartFromInput("2026-06-23").toISOString()).toBe("2026-06-23T06:00:00.000Z");
    expect(guatemalaDayStart(new Date("2026-06-23T23:00:00.000Z")).toISOString()).toBe("2026-06-23T06:00:00.000Z");
  });

  it("entrega un rango de 24h y formatea dd/mm/aaaa en hora de Guatemala", () => {
    const { start, end } = guatemalaDayRange(new Date("2026-06-23T12:00:00.000Z"));
    expect(start.toISOString()).toBe("2026-06-23T06:00:00.000Z");
    expect(end.toISOString()).toBe("2026-06-24T06:00:00.000Z");
    expect(formatGuatemalaDate(new Date("2026-06-23T06:00:00.000Z"))).toBe("23/06/2026");
  });
});
