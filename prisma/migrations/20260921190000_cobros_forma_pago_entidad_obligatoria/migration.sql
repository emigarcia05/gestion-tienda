-- cobros_forma_pago.entidad_obligatoria: permite formas de pago sin entidad
ALTER TABLE "cobros_forma_pago"
ADD COLUMN IF NOT EXISTS "entidad_obligatoria" BOOLEAN NOT NULL DEFAULT true;
