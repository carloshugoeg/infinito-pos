const GUATEMALA_UTC_OFFSET_HOURS = -6;

export function formatGuatemalaTime(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const guatemalaTime = new Date(date.getTime() + GUATEMALA_UTC_OFFSET_HOURS * 60 * 60 * 1000);
  const hour24 = guatemalaTime.getUTCHours();
  const minute = guatemalaTime.getUTCMinutes();
  const hour12 = hour24 % 12 || 12;
  const meridiem = hour24 < 12 ? "a. m." : "p. m.";

  return `${String(hour12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${meridiem}`;
}
