-- cobros_forma_pago: marca ALIAS por forma de pago (se edita en Crear / Editar Forma De Pago).
ALTER TABLE "cobros_forma_pago"
  ADD COLUMN IF NOT EXISTS "alias" BOOLEAN NOT NULL DEFAULT false;
