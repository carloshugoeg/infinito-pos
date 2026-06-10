# Documentación — Koi POS V1

Índice de lectura por rol. No duplica contenido; apunta al archivo correcto.

---

## ¿Qué leer primero?

| Rol | Orden de lectura |
| --- | --- |
| **Agente / dev nuevo** | [`AGENTS.md`](../AGENTS.md) → [`requirements.md`](requirements.md) → [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) — ver también regla `.cursor/rules/checklist-discipline.mdc` |
| **Entender el sistema (as-built)** | [`APP_CONTEXT.md`](APP_CONTEXT.md) |
| **Setup local** | [`README.md`](../README.md) |
| **Deploy producción** | [`DEPLOY.md`](DEPLOY.md) + [`GO_LIVE_CHECKLIST.md`](GO_LIVE_CHECKLIST.md) |
| **QA / auditorías** | [`qa/`](qa/) |

---

## Archivos en `docs/`

| Archivo | Propósito |
| --- | --- |
| [`requirements.md`](requirements.md) | PRD original — visión producto (SaaS, KDS, etc.) |
| [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) | Progreso V1 — actualizar con cada cambio de código |
| [`APP_CONTEXT.md`](APP_CONTEXT.md) | Referencia técnica: arquitectura, dominio, rutas, flujos |
| [`DEPLOY.md`](DEPLOY.md) | Runbook Supabase + Vercel (copy-paste) |
| [`GO_LIVE_CHECKLIST.md`](GO_LIVE_CHECKLIST.md) | P0/P1/P2/P3 antes de prod — **en uso activo** |
| [`qa/e2e-audit-2026-06-09.md`](qa/e2e-audit-2026-06-09.md) | Snapshot informe E2E (congelado) |
| [`qa/open-issues.md`](qa/open-issues.md) | Gaps E2E y seguridad pendiente |
| [`qa/security.md`](qa/security.md) | Postura de seguridad actualizada |

---

## Redirecciones (paths legacy)

Estos archivos en la raíz de `docs/` redirigen a `docs/qa/` para no romper enlaces existentes:

- `ERRORES_Y_HALLAZGOS.md` → issues resueltos + [`qa/open-issues.md`](qa/open-issues.md)
- `E2E_AUDIT_REPORT.md` → [`qa/e2e-audit-2026-06-09.md`](qa/e2e-audit-2026-06-09.md)
- `security-audit.md` → [`qa/security.md`](qa/security.md)

---

## Fuera del repositorio

- **Documentación comercial de ventas** (`koi-pos-documentacion-ventas.docx`): copia externa fuera de git (Drive/Notion del negocio).
