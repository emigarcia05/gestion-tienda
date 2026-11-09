-- Dirección y horario de atención de la sucursal.
-- El teléfono sigue en `whatsapp` (lo lee el PDF del comprobante).
ALTER TABLE "sucursales" ADD COLUMN "direccion" TEXT;
ALTER TABLE "sucursales" ADD COLUMN "horario" JSONB NOT NULL DEFAULT '{"lunVie":{"modo":"cerrado"},"sabado":{"modo":"cerrado"},"domingo":{"modo":"cerrado"}}'::jsonb;
