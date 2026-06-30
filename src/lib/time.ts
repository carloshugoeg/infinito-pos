export const GUATEMALA_UTC_OFFSET_HOURS = -6;
const GUATEMALA_OFFSET_MS = GUATEMALA_UTC_OFFSET_HOURS * 60 * 60 * 1000;
export const GUATEMALA_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Desplaza un instante a la "hora de pared" de Guatemala (UTC-6) para poder leer
 * los componentes de calendario con getUTC*. Guatemala no observa horario de verano,
 * así que el offset es fijo todo el año.
 */
function toGuatemalaWallClock(date: Date) {
  return new Date(date.getTime() + GUATEMALA_OFFSET_MS);
}

export function formatGuatemalaTime(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const guatemalaTime = toGuatemalaWallClock(date);
  const hour24 = guatemalaTime.getUTCHours();
  const minute = guatemalaTime.getUTCMinutes();
  const hour12 = hour24 % 12 || 12;
  const meridiem = hour24 < 12 ? "a. m." : "p. m.";

  return `${String(hour12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${meridiem}`;
}

/** Fecha calendario `YYYY-MM-DD` en hora de Guatemala para un instante dado. */
export function guatemalaDateInput(value: string | Date = new Date()) {
  const date = typeof value === "string" ? new Date(value) : value;
  const wall = toGuatemalaWallClock(date);
  const year = wall.getUTCFullYear();
  const month = String(wall.getUTCMonth() + 1).padStart(2, "0");
  const day = String(wall.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Instante (UTC) de las 00:00 de Guatemala para una fecha `YYYY-MM-DD`.
 * 00:00 en Guatemala (UTC-6) equivale a las 06:00 UTC del mismo día.
 */
export function guatemalaDayStartFromInput(dateInput: string) {
  const [year, month, day] = dateInput.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day) - GUATEMALA_OFFSET_MS);
}

/** Instante (UTC) de las 00:00 de Guatemala del día que contiene `value`. */
export function guatemalaDayStart(value: string | Date = new Date()) {
  return guatemalaDayStartFromInput(guatemalaDateInput(value));
}

/** Componentes de calendario (año, mes 0-11, día, día de semana) en hora de Guatemala. */
export function guatemalaCalendarParts(value: string | Date = new Date()) {
  const date = typeof value === "string" ? new Date(value) : value;
  const wall = toGuatemalaWallClock(date);
  return {
    year: wall.getUTCFullYear(),
    monthIndex: wall.getUTCMonth(),
    day: wall.getUTCDate(),
    weekday: wall.getUTCDay()
  };
}

/** Rango `[00:00, 24:00)` en hora de Guatemala del día que contiene `value`. */
export function guatemalaDayRange(value: string | Date = new Date()) {
  const start = guatemalaDayStart(value);
  return { start, end: new Date(start.getTime() + GUATEMALA_DAY_MS) };
}

/** Fecha `dd/mm/aaaa` en hora de Guatemala. */
export function formatGuatemalaDate(value: string | Date) {
  const [year, month, day] = guatemalaDateInput(value).split("-");
  return `${day}/${month}/${year}`;
}

/**
 * Fecha y hora `dd/mm/aaaa HH:MM` (24h) en hora de Guatemala, solo ASCII.
 * Pensada para exportaciones (CSV/Excel): sin sufijo "a. m./p. m." ni dependencia
 * de la zona horaria del servidor (en Vercel el server corre en UTC).
 */
export function formatGuatemalaDateTime(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const wall = toGuatemalaWallClock(date);
  const hours = String(wall.getUTCHours()).padStart(2, "0");
  const minutes = String(wall.getUTCMinutes()).padStart(2, "0");
  return `${formatGuatemalaDate(date)} ${hours}:${minutes}`;
}
