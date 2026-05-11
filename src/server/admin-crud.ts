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
