-- AlterEnum
-- Nuevo metodo de pago para pedidos liquidados por plataformas de delivery
-- (p. ej. Pedidos Ya). No entra a efectivo ni tarjeta/transferencia: la
-- plataforma deposita en su propio horario, asi que la caja no descuadra.
ALTER TYPE "PaymentMethod" ADD VALUE 'DELIVERY';
