# PLAN_FEL.md — Integración FEL (SAT Guatemala) para koi-pos / Infinito

> **Naturaleza del proyecto:** integración fiscal con **valor legal**. La precisión prima sobre la
> velocidad. Un error tiene consecuencia legal/tributaria (multas, IVA no recuperable, DTE inválido).
> Este documento es un **plan**, no código. No se ha modificado ningún archivo del sistema.

**Fecha:** 2026-06-10 · **Estado del código hoy:** campos `fel*` existen como *placeholders* sin uso
(ver [prisma/schema.prisma:256-258](prisma/schema.prisma:256)); `taxTotal` hardcodeado en `0`
([src/domain/cart.ts:103-111](src/domain/cart.ts:103)); no existe generación de factura/recibo.

---

## 0. Cómo leer este plan

- Las **suposiciones** están marcadas con `🟡 SUPOSICIÓN` y deben confirmarse antes de codificar lo que dependa de ellas.
- Los **puntos de impacto legal** están marcados con `🔴 RIESGO LEGAL` e incluyen su mitigación.
- Las fuentes pueden cambiar (normativa SAT, docs del certificador). Cada bloque sensible incluye
  **"cómo verificar"**. No se asume certeza sobre lo que la SAT o el certificador puedan haber cambiado.
- El plan está dividido en **Parte A (mundo real: fiscal/legal)** y **Parte B (código por fases)**.

---

## 1. Glosario mínimo (verificado en FASE 2)

| Término | Significado |
|---|---|
| **FEL** | Factura Electrónica en Línea. Régimen vigente. Reemplazó a FACE/GFACE. |
| **DTE** | Documento Tributario Electrónico (factura, nota de crédito, etc.). |
| **Certificador** | Tercero autorizado por SAT que **valida y firma** el DTE y asigna número de autorización (UUID). |
| **FACT / FPEQ** | Factura régimen general / Factura Pequeño Contribuyente. |
| **NCRE / NDEB / NABN** | Nota de Crédito / Débito / Abono. |
| **CF** | Consumidor Final. Solo válido en ventas < Q2,500. |
| **UUID** | Identificador único de autorización que devuelve el certificador. |

---

## 2. Hechos confirmados en FASE 2 (con fuentes)

1. **Flujo:** POS genera XML del DTE → **Certificador** valida reglas + aplica **firma electrónica
   avanzada** + asigna UUID → **SAT** valida y acusa → DTE certificado regresa (XML + representación
   gráfica) y se entrega al cliente. _Fuentes: Portal SAT eFactura; EDICOM; HaaB._
2. **Quién firma:** **el certificador**, no el POS. El POS genera contenido y se autentica
   (normalmente **token/usuario-clave por API**). _Fuentes: EDICOM CO; Digifact FAQ._
3. **IVA (régimen general):** 12% **incluido en el precio**; el DTE lo **desglosa**
   (`MontoGravable = total/1.12`, `IVA = total − MontoGravable`). Verificado en XML real de Megaprint
   (`0.89 + 0.11 = 1.00`). _Fuentes: repo Ejemplos-XML Megaprint; Reglas y Validaciones DTE._
4. **Pequeño Contribuyente:** paga **5%**, **no cobra IVA**; FPEQ lleva la frase
   **"No genera derecho a crédito fiscal"**. _Fuentes: Softland; Dconta._
5. **CF limitado:** "CF" solo en ventas **< Q2,500**; desde Q2,500 se exige **NIT** (o **CUI/DPI**).
   SAT/certificador **no autorizan** el DTE si se incumple. _Fuentes: Prensa Libre; DCA._
6. **Anulación:** no se borra un DTE. Anulación dentro del **mes de emisión** y hasta el vencimiento
   de la **declaración mensual de IVA**; fuera de plazo → NCRE (IVA puede no recuperarse); extemporánea
   requiere aprobación de SAT. NCRE **1-a-1** con la factura. _Fuentes: Gosocket; Prensa Libre._
7. **Sandbox:** cada certificador ofrece **PRUEBAS + PRODUCCIÓN** y entrega credenciales de prueba a
   solicitud; APIs REST/JSON o SOAP; token (Digifact ~360 días). _Fuentes: Digifact docs; FELplex API._

**Cómo verificar (porque cambia):**
- Lista oficial de certificadores: https://portal.sat.gob.gt/portal/certificador-de-dte/
- "Documento Técnico Informático para Certificadores", "Reglas y Validaciones DTE" y **XSD** del DTE:
  Portal SAT → Factura Electrónica FEL → descargas. (El XSD es la **fuente normativa** de la estructura.)
- Documentación API del certificador elegido (token, endpoints PRUEBAS/PROD, catálogos).

---

## 3. Suposiciones a confirmar ANTES de codificar lo dependiente

| # | 🟡 SUPOSICIÓN / Pregunta | Responsable de confirmar | Bloquea |
|---|---|---|---|
| S1 | **Régimen de Infinito** = ¿General (12% IVA, FACT) o Pequeño Contribuyente (5%, FPEQ)? | **Infinito + contador** | Toda la lógica de IVA, tipo de DTE y frases |
| S2 | NIT emisor, razón social, dirección fiscal, código de establecimiento | **Infinito** | Datos del emisor en el DTE |
| S3 | Certificador a usar (Infile/Guatefacturas/Digifact/Megaprint/FELplex…) | **Infinito** (contrato) | Cliente API, auth, sandbox |
| S4 | ¿Ya habilitado en FEL y con contrato de certificador, o desde cero? | **Infinito** | Punto de partida |
| S5 | Modelo de credenciales: token API vs `.p12` propio | **Certificador** (lo valida la agencia) | Manejo de secretos |
| S6 | Frases obligatorias, series, manejo de propina/servicio, exentos | **Infinito + contador** | Contenido del DTE |
| S7 | Representación gráfica: térmica / PDF / correo al cliente | **Infinito** | Entregable de "recibo" |
| S8 | Emisión síncrona (bloqueante en cobro) vs asíncrona con reintento | Conjunta (se **recomienda asíncrona**) | Diseño técnico |
| S9 | ¿Multi-sucursal afecta numeración/establecimientos por sucursal? | **Infinito + certificador** | Mapeo `Branch` ↔ establecimiento |

> **Default de trabajo mientras se confirma S1:** asumir **régimen General (FACT con IVA 12%
> incluido)** porque es el caso con más reglas; si resulta Pequeño Contribuyente, se simplifica
> (sin desglose de IVA + frase FPEQ). **No se promueve a producción nada sin S1 confirmado.**

---

## PARTE A — Acciones del mundo real (fiscal / legal)

> Estas acciones **no son código** y en su mayoría son **responsabilidad del cliente Infinito**
> (es su NIT y su obligación tributaria). La agencia acompaña técnicamente.

### A1. Determinar el régimen (cliente + contador) — **prerequisito de todo**
- Confirmar General vs Pequeño Contribuyente y dejarlo **por escrito** (correo del contador basta).
- 🔴 **RIESGO LEGAL:** emitir el tipo de DTE equivocado (FACT vs FPEQ) o cobrar/no cobrar IVA mal.
  **Mitigación:** no codificar IVA hasta tener S1 por escrito; cubrir ambos caminos con pruebas.

### A2. Habilitación FEL ante SAT (cliente)
- Inscribir/confirmar al NIT en el régimen FEL en Agencia Virtual SAT; obtener el **certificado de
  firma** que genera SAT al habilitar.
- **Cómo verificar:** Portal SAT → eFactura → habilitación; o que el contador lo gestione.

### A3. Elegir y contratar certificador (cliente)
- Seleccionar de la **lista oficial vigente** (verificar el día de la decisión, cambia).
- Solicitar: **credenciales de PRUEBAS**, documentación API, catálogos, XSD soportado, costo por DTE.
- 🟡 **SUPOSICIÓN:** el certificador entrega ambiente de pruebas (confirmado como práctica general,
  pero el alcance del sandbox varía por proveedor).

### A4. Definir datos de emisión con el contador (cliente + contador)
- NIT, razón social, dirección fiscal, **establecimientos** (uno por sucursal si aplica), series,
  **frases obligatorias** (p.ej. "No genera derecho a crédito fiscal" si FPEQ), unidades de medida,
  catálogo de productos/servicios para el campo `BienOServicio`.
- 🔴 **RIESGO LEGAL:** faltar una frase obligatoria invalida el DTE. **Mitigación:** las frases se
  cargan como **configuración** (no hardcode) y se validan contra la respuesta del certificador en sandbox.

### A5. Procedimiento de anulación / contingencia (cliente + agencia)
- Acordar con el contador el flujo de **anulación dentro de plazo** y de **NCRE** fuera de plazo.
- Definir **plan de contingencia** ante caída del certificador/SAT (¿se detiene la venta? ¿se cobra y
  se certifica diferido?). 🔴 **RIESGO LEGAL:** vender sin DTE. **Mitigación:** ver B-Fase 4 (cola con
  reintento + estado `PENDIENTE_FEL`, nunca silenciar el fallo).

### A6. Conservación y entrega (cliente + agencia)
- Conservar XML certificados (obligación de resguardo) y poder **entregar** el DTE al cliente.
- **Cómo verificar:** Reglas SAT de conservación vigentes; muchos certificadores ya archivan, confirmar.

---

## PARTE B — Acciones de código (por fases)

> Reglas transversales (de AGENTS.md y del encargo):
> - **Backend recalcula** precios, IVA y totales; no duplicar lógica cliente/servidor.
> - **Jamás hardcodear** `.p12`, tokens ni credenciales → **variables de entorno**.
> - No bloquear la venta por fallo de stock (regla existente); decidir explícitamente la política ante
>   fallo de FEL (Fase 4).
> - Dominio puro y testeado con Vitest para todo lo fiscal (IVA, validación NIT, mapeo DTE).
> - Cada cambio actualiza `docs/IMPLEMENTATION_PLAN.md` (regla de progreso del repo).

### B-Fase 0 — Andamiaje y configuración (sin tocar el flujo de venta)
**Objetivo:** poder configurar y autenticar contra el certificador en **sandbox**, sin emitir aún.
- Variables de entorno (nuevas, **solo servidor**): `FEL_ENV` (`sandbox|prod`), `FEL_CERTIFIER`
  (identificador del proveedor), `FEL_API_BASE_URL`, `FEL_API_TOKEN`/`FEL_API_USER`+`FEL_API_PASSWORD`,
  y `FEL_SIGN_CERT_PATH`/`FEL_SIGN_CERT_PASSWORD` **solo si** S5 confirma `.p12`.
  Documentar en `.env.example` con valores ficticios (nunca reales).
- Extender `AppSettings` (o nueva tabla `FelConfig`) con: `emisorNit`, `emisorNombre`, `emisorDireccion`,
  `regimen` (`GENERAL|PEQUENO`), `frases` (texto/JSON), `defaultDteType`. **Sin secretos en la BD.**
- Mapear `Branch` ↔ `establecimiento` (campo nuevo `establecimientoCode` en `Branch`) — depende de S9.
- Crear `src/server/services/fiscal.ts` (cliente del certificador) siguiendo el patrón idempotente de
  [notifications.ts](src/server/services/notifications.ts). Solo `ping`/auth en esta fase.
- **Entregable verificable:** test que autentica en sandbox y obtiene token; nada se emite.
- 🟡 **SUPOSICIÓN:** REST/JSON. Si el certificador es SOAP, agregar dependencia `soap` y ajustar.

### B-Fase 1 — Lógica fiscal pura (IVA, NIT, mapeo a DTE) — **TDD, sin red**
**Objetivo:** funciones puras, 100% testeadas, que produzcan el DTE correcto. Aquí vive el riesgo fiscal.
- `src/domain/tax.ts` (nuevo): cálculo de IVA **según régimen**.
  - General: `montoGravable = round(total/1.12)`, `iva = round(total − montoGravable)` por ítem y total.
  - Pequeño: sin IVA; adjuntar frase FPEQ.
  - 🔴 **RIESGO LEGAL:** redondeo. SAT valida que la suma de ítems cuadre con el total con la
    precisión exigida. **Mitigación:** definir regla de redondeo (2 decimales, medio-arriba) y
    **tests con los ejemplos del XSD/Reglas y Validaciones**; cuadre ítem-a-total como invariante.
- `src/domain/nit.ts` (nuevo): validación de **NIT** (dígito verificador) y **CUI/DPI**; normalizar "CF".
  - 🔴 **RIESGO LEGAL:** regla **CF < Q2,500**. Implementar: si `total ≥ 2500` y receptor = CF →
    **bloquear** y exigir NIT/CUI. **Mitigación:** validación en dominio + UI + se confía en que el
    certificador la rechace igualmente (doble control). _Verificar umbral vigente con el contador._
- `src/domain/fel-mapper.ts` (nuevo): construir el objeto/`XML` del DTE desde un `Order` (usar los
  **snapshots** existentes `productNameSnapshot`, `basePriceSnapshot`, etc. — ya congelados, ideal).
  - Validar contra el **XSD** del certificador/SAT en pruebas.
- **Ajuste mínimo a `calculateOrderTotals`** ([cart.ts:103](src/domain/cart.ts:103)): hoy fija `taxTotal:0`.
  Debe poblar `taxTotal` con el **IVA contenido** cuando el régimen sea General. (Cambio sensible:
  cubrir con tests y no alterar el `total`, que sigue siendo el precio al público.)
- **Entregable verificable:** Vitest verde con casos límite (1 ítem, múltiples, descuentos, CF≥Q2,500,
  FPEQ, exentos). **Cero llamadas de red.**

### B-Fase 2 — Persistencia y máquina de estados FEL (BD)
**Objetivo:** registrar el ciclo de vida del DTE de forma auditable e idempotente.
- Usar/poblar `Order.felUuid`, `felDteNumber`, `felCertifiedAt`; agregar:
  `felStatus` (`PENDIENTE|CERTIFICADO|RECHAZADO|ANULADO`), `felDteType`, `felSerie`,
  `felErrorMessage`, `felRequestPayload`/`felResponsePayload` (auditoría), `felAttempts`.
- Nueva tabla `FelEvent` (bitácora append-only: intento, request, response, código de error) — patrón
  de idempotencia como `EmailLog`.
- Nueva tabla/relación para **NCRE/anulaciones** ligadas 1-a-1 al `Order` original.
- Migración Prisma (con `DIRECT_URL`); **idempotencia**: una venta no puede certificarse dos veces
  (índice único por `orderId` en el evento de certificación exitosa).
- 🔴 **RIESGO LEGAL:** doble emisión / numeración duplicada. **Mitigación:** unicidad en BD + chequear
  estado antes de reintentar; el número de autorización lo asigna el certificador, no el POS.
- **Entregable verificable:** migración aplicada en entorno de prueba; tests de transición de estado.

### B-Fase 3 — Cliente del certificador en sandbox (red real, ambiente de pruebas)
**Objetivo:** emitir DTE **reales en PRUEBAS** y parsear la respuesta.
- Implementar en `fiscal.ts`: `certificarDTE(order)`, `anularDTE(...)`, manejo de errores tipados,
  timeouts y reintentos con backoff. Firma: si el modelo es token, **no** se firma localmente; si S5 =
  `.p12`, cargar el certificado **desde env/secret store**, nunca del repo.
- Persistir UUID/serie/número/fecha y `felResponsePayload`.
- 🔴 **RIESGO LEGAL:** tratar un rechazo como éxito. **Mitigación:** la venta solo se marca
  `CERTIFICADO` con acuse positivo del certificador; cualquier otra cosa → `PENDIENTE`/`RECHAZADO`
  visible para el operador, nunca oculto.
- **Entregable verificable:** DTE de prueba certificado contra sandbox + su representación gráfica;
  pruebas de NCRE/anulación en sandbox.

### B-Fase 4 — Integración con el flujo de venta (asíncrona, resiliente)
**Objetivo:** conectar FEL al cobro sin frenar la caja ante caídas.
- En [order-actions.ts](src/server/actions/order-actions.ts) / [orders.ts](src/server/services/orders.ts):
  tras crear el `Order` (transacción existente), **encolar** la certificación (estado inicial
  `PENDIENTE_FEL`). 🟡 **SUPOSICIÓN S8:** emisión **asíncrona** recomendada (la venta no se bloquea;
  un worker/cron certifica y reintenta). Si Infinito exige DTE **antes** de entregar el producto,
  conmutar a **síncrona con timeout** y fallback a cola.
- Worker/route de reintento (Vercel Cron o ruta server) que procesa `PENDIENTE` con backoff y tope.
- Panel para el operador/admin: ver estado FEL, reintentar, ver motivo de rechazo, emitir NCRE.
- 🔴 **RIESGO LEGAL:** ventas sin DTE acumuladas y olvidadas. **Mitigación:** alerta cuando hay
  `PENDIENTE` antiguos; el cierre de caja muestra pendientes FEL; nada se "auto-resuelve" en silencio.

### B-Fase 5 — Representación gráfica y entrega (depende de S7)
- Generar la **representación gráfica** del DTE (PDF/HTML imprimible o ticket térmico) con UUID, NIT
  emisor/receptor, desglose de IVA, frases y datos obligatorios.
- Entrega al cliente (pantalla/QR/impresión/correo según S7).

### B-Fase 6 — Reportes, conservación y reconciliación
- Incluir `felUuid/serie/número/estado` en el **export CSV** ([export/route.ts](src/app/admin/reports/export/route.ts))
  y reportes de finanzas.
- Reporte de **conciliación fiscal**: ventas vs DTE certificados vs anulados; detectar huecos.
- Resguardo de XML certificados (A6).

---

## 4. Estrategia de pruebas en SANDBOX **antes** de tocar credenciales reales

> Principio: **nada toca producción ni el NIT real hasta que el sandbox esté 100% verde.**

1. **Aislamiento por entorno:** `FEL_ENV=sandbox` por defecto. Las URLs y credenciales de PRUEBAS
   viven en `.env.local`/secrets de entorno de desarrollo; **producción es un set de variables
   separado** y se activa solo con S1–S6 confirmados.
2. **Capa de dominio sin red (B-Fase 1):** toda la lógica fiscal se prueba con **Vitest** usando los
   ejemplos del **XSD/Reglas y Validaciones** y el **XML real** de referencia. Cuadre ítem-a-total
   como invariante de prueba.
3. **Contrato contra sandbox del certificador (B-Fase 3):** suite de integración que emite cada tipo
   de DTE relevante (FACT/FPEQ, NCRE, anulación) en **PRUEBAS**, validando UUID y estructura.
4. **Casos límite obligatorios:** CF ≥ Q2,500 (debe rechazar), NIT inválido, descuentos, exentos,
   redondeo, timeout/caída del certificador (reintento), doble certificación (idempotencia).
5. **Checklist de promoción a producción** (gate manual): S1 por escrito ✔, NIT emisor verificado ✔,
   credenciales prod en env (no en repo) ✔, una **emisión piloto controlada** revisada por el contador ✔,
   plan de anulación probado ✔, plan de contingencia definido ✔.
6. **Rollback / contingencia:** poder volver a `FEL_ENV=sandbox` o pausar la emisión sin frenar el POS;
   las ventas quedan `PENDIENTE_FEL` y se certifican al restablecer.

---

## 5. Mapa de archivos afectados (referencia rápida)

| Área | Archivo | Cambio |
|---|---|---|
| Esquema | [prisma/schema.prisma](prisma/schema.prisma) | usar `fel*`; `felStatus/Type/Serie/...`; `FelEvent`; NCRE; config emisor; `establecimientoCode` en `Branch` |
| IVA/totales | [src/domain/cart.ts](src/domain/cart.ts) | poblar `taxTotal` (IVA contenido) según régimen |
| Impuesto (nuevo) | `src/domain/tax.ts` | cálculo IVA por régimen + redondeo |
| NIT (nuevo) | `src/domain/nit.ts` | validación NIT/CUI + regla CF<Q2,500 |
| Mapper (nuevo) | `src/domain/fel-mapper.ts` | `Order` → DTE (XML/JSON) |
| Certificador (nuevo) | `src/server/services/fiscal.ts` | auth, certificar, anular, reintentos |
| Orden | [src/server/services/orders.ts](src/server/services/orders.ts) | encolar certificación tras la venta |
| Acción venta | [src/server/actions/order-actions.ts](src/server/actions/order-actions.ts) | orquestar emisión/estado |
| Captura cliente | [src/components/kiosk/kiosk-client.tsx](src/components/kiosk/kiosk-client.tsx) | validar NIT, dirección, regla CF |
| Config | `AppSettings`/`FelConfig` + UI admin nueva | datos del emisor (sin secretos) |
| Reportes | [src/app/admin/reports/export/route.ts](src/app/admin/reports/export/route.ts) | incluir campos FEL |
| Recibo (nuevo) | `src/...` (PDF/HTML/ticket) | representación gráfica del DTE |
| Env | `.env.example` | variables FEL documentadas (ficticias) |

---

## 6. Resumen de puntos de impacto legal y su mitigación

| 🔴 Riesgo | Mitigación |
|---|---|
| Tipo de DTE equivocado (FACT vs FPEQ) | No codificar IVA hasta S1 por escrito; ambos caminos con tests |
| IVA mal desglosado / redondeo | Dominio puro testeado contra XSD/ejemplos; cuadre ítem-a-total como invariante |
| Emitir CF ≥ Q2,500 | Bloqueo en dominio + UI; doble control con rechazo del certificador |
| Doble emisión / numeración duplicada | Unicidad en BD; el número lo asigna el certificador; chequeo de estado antes de reintentar |
| Rechazo tratado como éxito | Solo `CERTIFICADO` con acuse positivo; rechazos visibles, nunca ocultos |
| Ventas sin DTE acumuladas | Estado `PENDIENTE_FEL` + alertas + visibilidad en cierre de caja |
| Anulación fuera de plazo | Flujo NCRE acordado con contador; avisos de plazo (mes de emisión / venc. IVA) |
| Falta de frase obligatoria | Frases como configuración, validadas en sandbox |
| Credenciales/`.p12` expuestos | Solo variables de entorno/secret store; nunca en repo ni en BD; `.env.example` ficticio |

---

## 7. Verificación de fuentes que cambian (no inflar certeza)

- **Estructura del DTE (autoritativa):** XSD oficial del DTE en Portal SAT → FEL → descargas, y el del
  certificador elegido. **Ante cualquier duda de campos, manda el XSD, no este documento.**
- **Reglas (CF<Q2,500, frases, anulación, NIT obligatorio):** "Reglas y Validaciones DTE" (SAT) versión
  vigente + confirmación del **contador** de Infinito. Las versiones cambian (vimos v1.7.1; Decreto
  31-2024 vig. 2025). **Verificar la versión al iniciar la codificación de B-Fase 1.**
- **Lista y capacidades del certificador:** su documentación API vigente (endpoints PRUEBAS/PROD, auth,
  catálogos). Confirmar el modelo de firma (S5) directamente con su soporte.
- **Régimen y datos del emisor:** únicamente válidos por confirmación escrita de Infinito/contador.

---

### Próximo paso sugerido
Conseguir **S1 (régimen)**, **S3 (certificador)** y **S4 (estado de habilitación)**. Con eso, arranco
**B-Fase 0 + B-Fase 1** (andamiaje + dominio fiscal puro con TDD), que **no tocan producción ni
credenciales reales** y dejan listo todo lo verificable en sandbox.
