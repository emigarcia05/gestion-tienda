ALTER TABLE "public"."cobros_forma_pago"
ADD COLUMN IF NOT EXISTS "fecha_acreditacion_variable" BOOLEAN NOT NULL DEFAULT false;
