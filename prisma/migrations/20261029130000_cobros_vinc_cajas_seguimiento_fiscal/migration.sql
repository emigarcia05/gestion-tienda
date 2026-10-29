-- cobros_vinc_cajas: marca de seguimiento fiscal por vínculo (forma × entidad × sucursal).
ALTER TABLE "cobros_vinc_cajas"
  ADD COLUMN IF NOT EXISTS "seguimiento_fiscal" BOOLEAN NOT NULL DEFAULT false;
