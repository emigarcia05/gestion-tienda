-- Días de vencimiento para recordatorio de saldo impago (comprobantes_vtas)

ALTER TABLE "comprobantes_vtas"
  ADD COLUMN IF NOT EXISTS "dias_vencimiento" INTEGER;
