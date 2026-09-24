-- clientes.contrasena_cuenta_corriente (revertida por 20260924220000)
ALTER TABLE "clientes"
  ADD COLUMN IF NOT EXISTS "contrasena_cuenta_corriente" VARCHAR(100);
