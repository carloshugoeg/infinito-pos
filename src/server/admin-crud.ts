export type RemovalMode = "delete" | "deactivate";

export function normalizeFormText(value: FormDataEntryValue | null | undefined, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

export function normalizeBranchCode(value: FormDataEntryValue | null | undefined) {
  return normalizeFormText(value).toUpperCase();
}

export function chooseRemovalMode(dependencyCount: number): RemovalMode {
  return dependencyCount > 0 ? "deactivate" : "delete";
}

export function parseNumberField(
  value: FormDataEntryValue | null | undefined,
  label: string,
  options: { fallback?: number; min?: number; max?: number; integer?: boolean; decimals?: number } = {}
) {
  const raw = String(value ?? "").trim();
  const parsed = raw === "" && options.fallback !== undefined ? options.fallback : Number(raw);
  if (!Number.isFinite(parsed)) throw new Error(`${label} debe ser un numero valido.`);
  if (options.integer && !Number.isInteger(parsed)) throw new Error(`${label} debe ser un entero.`);
  if (options.min !== undefined && parsed < options.min) throw new Error(`${label} no puede ser menor que ${options.min}.`);
  if (options.max !== undefined && parsed > options.max) throw new Error(`${label} no puede ser mayor que ${options.max}.`);
  if (options.decimals !== undefined && !hasDecimalPrecision(parsed, options.decimals)) {
    throw new Error(`${label} permite maximo ${options.decimals} decimales.`);
  }
  return parsed;
}

/**
 * Igual que parseNumberField pero para campos opcionales: cadena vacia devuelve null
 * (no aplica fallback). Util para metadatos de compra que pueden quedar sin definir.
 */
export function parseOptionalNumberField(
  value: FormDataEntryValue | null | undefined,
  label: string,
  options: { min?: number; max?: number; decimals?: number } = {}
): number | null {
  const raw = String(value ?? "").trim();
  if (raw === "") return null;
  return parseNumberField(raw, label, options);
}

export function parseReportDateRange(from: string | null | undefined, to: string | null | undefined, now = new Date()) {
  const today = formatDateInput(now);
  const startInput = isDateInput(from) ? String(from) : today;
  const endInput = isDateInput(to) ? String(to) : startInput;
  const start = dateInputToLocalDate(startInput);
  const end = dateInputToLocalDate(endInput);
  end.setDate(end.getDate() + 1);

  if (end <= start) {
    const fallbackEnd = new Date(start);
    fallbackEnd.setDate(fallbackEnd.getDate() + 1);
    return { start, end: fallbackEnd, startInput, endInput: startInput };
  }

  return { start, end, startInput, endInput };
}

/** Máximo de días permitido en exportaciones de reportes (P1-SEC-03). */
export const MAX_REPORT_RANGE_DAYS = 31;

/**
 * Días completos cubiertos por un rango de `parseReportDateRange` (el `end` es exclusivo,
 * así que un solo día devuelve 1). Se redondea para tolerar saltos de horario (DST).
 */
export function reportRangeDays(range: { start: Date; end: Date }) {
  return Math.round((range.end.getTime() - range.start.getTime()) / 86_400_000);
}

function hasDecimalPrecision(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.abs(value * factor - Math.round(value * factor)) < 1e-9;
}

function isDateInput(value: string | null | undefined) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function dateInputToLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
