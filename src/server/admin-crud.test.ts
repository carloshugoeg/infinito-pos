import { describe, expect, it } from "vitest";
import {
  MAX_REPORT_RANGE_DAYS,
  chooseRemovalMode,
  normalizeBranchCode,
  normalizeFormText,
  parseNumberField,
  parseReportDateRange,
  reportRangeDays
} from "@/server/admin-crud";

describe("admin CRUD helpers", () => {
  it("normalizes text fields with fallback values", () => {
    expect(normalizeFormText("  Sucursal Centro  ")).toBe("Sucursal Centro");
    expect(normalizeFormText("", "Sin nombre")).toBe("Sin nombre");
    expect(normalizeFormText(null, "Sin nombre")).toBe("Sin nombre");
  });

  it("normalizes branch codes for unique lookups", () => {
    expect(normalizeBranchCode(" koi-1 ")).toBe("KOI-1");
  });

  it("chooses soft deletion when a record already has history", () => {
    expect(chooseRemovalMode(0)).toBe("delete");
    expect(chooseRemovalMode(2)).toBe("deactivate");
  });

  it("parsea campos numericos con limites de negocio", () => {
    expect(parseNumberField("12.50", "Precio", { min: 0, decimals: 2 })).toBe(12.5);
    expect(() => parseNumberField("-1", "Precio", { min: 0 })).toThrow("Precio no puede ser menor que 0.");
    expect(() => parseNumberField("1.999", "Precio", { decimals: 2 })).toThrow("Precio permite maximo 2 decimales.");
    expect(() => parseNumberField("1.5", "Orden", { integer: true })).toThrow("Orden debe ser un entero.");
  });

  it("parses report dates as an inclusive day range anchored to Guatemala midnight", () => {
    const range = parseReportDateRange("2026-05-05", "2026-05-06", new Date("2026-05-07T21:00:00.000Z"));

    // 00:00 de Guatemala (UTC-6) === 06:00 UTC; el `end` es exclusivo (día siguiente).
    expect(range.start.toISOString()).toBe("2026-05-05T06:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-05-07T06:00:00.000Z");
    expect(range.startInput).toBe("2026-05-05");
    expect(range.endInput).toBe("2026-05-06");
  });

  it("usa el día de Guatemala para 'hoy' (el día no cambia a las 18:00)", () => {
    // 01:30 UTC del 23-jun === 19:30 del 22-jun en Guatemala: sigue siendo el 22.
    const evening = parseReportDateRange(null, null, new Date("2026-06-23T01:30:00.000Z"));
    expect(evening.startInput).toBe("2026-06-22");
    expect(evening.start.toISOString()).toBe("2026-06-22T06:00:00.000Z");
    expect(evening.end.toISOString()).toBe("2026-06-23T06:00:00.000Z");

    // 05:59 UTC === 23:59 del 22 en Guatemala: todavía el 22.
    expect(parseReportDateRange(null, null, new Date("2026-06-23T05:59:00.000Z")).startInput).toBe("2026-06-22");
    // 06:00 UTC === 00:00 del 23 en Guatemala: ya es el 23.
    expect(parseReportDateRange(null, null, new Date("2026-06-23T06:00:00.000Z")).startInput).toBe("2026-06-23");
  });

  it("cuenta los dias cubiertos por un rango (end exclusivo)", () => {
    const oneDay = parseReportDateRange("2026-05-05", "2026-05-05", new Date(2026, 4, 7));
    expect(reportRangeDays(oneDay)).toBe(1);

    const fullMonth = parseReportDateRange("2026-01-01", "2026-01-31", new Date(2026, 1, 1));
    expect(reportRangeDays(fullMonth)).toBe(MAX_REPORT_RANGE_DAYS);

    const overLimit = parseReportDateRange("2026-01-01", "2026-02-01", new Date(2026, 1, 2));
    expect(reportRangeDays(overLimit)).toBe(32);
    expect(reportRangeDays(overLimit)).toBeGreaterThan(MAX_REPORT_RANGE_DAYS);
  });
});
