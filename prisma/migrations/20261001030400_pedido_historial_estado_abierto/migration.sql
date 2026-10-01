-- Remueve el estado legacy "PENDIENTE" del historial de pedidos.
ALTER TABLE "prod_ped_historial"
ALTER COLUMN "estado" SET DEFAULT 'ABIERTO';

UPDATE "prod_ped_historial"
SET "estado" = 'ABIERTO'
WHERE "estado" IS NULL
   OR "estado" IN ('PENDIENTE', 'SIN RECEPCION');
