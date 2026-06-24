-- Realinea los gastos al día de Guatemala (00:00 GT = 06:00 UTC).
--
-- Antes `incurredOn` se guardaba a la medianoche LOCAL del servidor. En producción
-- (UTC) eso es 00:00:00 UTC, que equivale a las 18:00 del día ANTERIOR en Guatemala,
-- desalineando el gasto con el filtro de día de reportes/finanzas, que ahora se ancla
-- a las 00:00 de Guatemala (06:00 UTC).
--
-- Se reubican las filas guardadas exactamente a las 00:00:00 UTC a las 06:00:00 UTC
-- del mismo día calendario. Idempotente y seguro: las filas creadas en zona Guatemala
-- (ya a las 06:00 UTC) no coinciden con el filtro y quedan intactas. `incurredOn` es
-- TIMESTAMP(3) sin zona, así que el valor almacenado es la hora de pared en UTC.
UPDATE "Expense"
SET "incurredOn" = "incurredOn" + interval '6 hours'
WHERE "incurredOn"::time = '00:00:00';
