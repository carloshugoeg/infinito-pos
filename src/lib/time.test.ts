import { describe, expect, it } from "vitest";
import { formatGuatemalaTime } from "@/lib/time";

describe("time formatting", () => {
  it("formatea hora de Guatemala de forma estable para SSR e hidratacion", () => {
    expect(formatGuatemalaTime("2026-05-03T19:43:00.000Z")).toBe("01:43 p. m.");
    expect(formatGuatemalaTime("2026-05-03T07:05:00.000Z")).toBe("01:05 a. m.");
    expect(formatGuatemalaTime("2026-05-03T18:00:00.000Z")).toBe("12:00 p. m.");
  });
});
