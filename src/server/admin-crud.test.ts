import { describe, expect, it } from "vitest";
import { chooseRemovalMode, normalizeBranchCode, normalizeFormText, parseReportDateRange } from "@/server/admin-crud";

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

  it("parses report dates as an inclusive day range", () => {
    const range = parseReportDateRange("2026-05-05", "2026-05-06", new Date(2026, 4, 7, 15));

    expect(range.start.getFullYear()).toBe(2026);
    expect(range.start.getMonth()).toBe(4);
    expect(range.start.getDate()).toBe(5);
    expect(range.end.getFullYear()).toBe(2026);
    expect(range.end.getMonth()).toBe(4);
    expect(range.end.getDate()).toBe(7);
    expect(range.startInput).toBe("2026-05-05");
    expect(range.endInput).toBe("2026-05-06");
  });
});
