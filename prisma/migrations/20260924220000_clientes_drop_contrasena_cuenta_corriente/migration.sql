-- Quita clientes.contrasena_cuenta_corriente (no se usa).
ALTER TABLE "clientes"
  DROP COLUMN IF EXISTS "contrasena_cuenta_corriente";
