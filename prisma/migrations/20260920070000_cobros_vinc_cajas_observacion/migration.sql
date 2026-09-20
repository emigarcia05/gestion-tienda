-- Observación libre por vínculo (se sincroniza en el grupo pago × entidad)

ALTER TABLE "cobros_vinc_cajas"
  ADD COLUMN IF NOT EXISTS "observacion" TEXT NOT NULL DEFAULT '';
