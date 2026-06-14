import crypto from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "koi_session";

export type SessionPayload = {
  userId: string;
  activeBranchId?: string;
  expiresAt: number;
};

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "SESSION_SECRET is required (>=32 random chars). Set it in the environment before running the app."
    );
  }
  if (process.env.NODE_ENV === "production" && secret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters in production.");
  }
  return secret;
}

function sign(value: string) {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("hex");
}

const DEFAULT_SESSION_TTL_HOURS = 12;
const MIN_SESSION_TTL_HOURS = 1;
const MAX_SESSION_TTL_HOURS = 24;

/**
 * Duración de la sesión en ms (P1-SEC-01). Configurable vía `SESSION_TTL_HOURS`; por defecto
 * 12 h (cubre un turno largo sin cierre de sesión a media jornada). Valores inválidos o fuera
 * del rango 1–24 h caen al límite más cercano / al default.
 */
export function getSessionTtlMs() {
  const raw = process.env.SESSION_TTL_HOURS;
  const parsed = raw === undefined ? NaN : Number(raw);
  const hours = Number.isFinite(parsed) && parsed > 0
    ? Math.min(MAX_SESSION_TTL_HOURS, Math.max(MIN_SESSION_TTL_HOURS, parsed))
    : DEFAULT_SESSION_TTL_HOURS;
  return hours * 60 * 60 * 1000;
}

export function encodeSession(payload: SessionPayload) {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

export function decodeSession(value?: string): SessionPayload | null {
  if (!value) return null;
  const [body, signature] = value.split(".");
  if (!body || !signature || sign(body) !== signature) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.userId || payload.expiresAt < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function readSession() {
  const store = await cookies();
  return decodeSession(store.get(SESSION_COOKIE)?.value);
}

export async function writeSession(payload: Omit<SessionPayload, "expiresAt">) {
  const store = await cookies();
  const expiresAt = Date.now() + getSessionTtlMs();
  store.set(SESSION_COOKIE, encodeSession({ ...payload, expiresAt }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt)
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
