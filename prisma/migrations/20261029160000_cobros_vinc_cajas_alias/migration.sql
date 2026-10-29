-- cobros_vinc_cajas: ALIAS del cobro (obligatorio solo si cobros_forma_pago.alias = TRUE; si no, NULL).
ALTER TABLE "cobros_vinc_cajas"
  ADD COLUMN IF NOT EXISTS "alias" TEXT;
