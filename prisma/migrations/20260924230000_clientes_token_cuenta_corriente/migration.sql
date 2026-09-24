-- Token del visor público de cuenta corriente (`/cc/{token}`).
ALTER TABLE "clientes"
  ADD COLUMN IF NOT EXISTS "token_cuenta_corriente" VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS "clientes_token_cuenta_corriente_key"
  ON "clientes" ("token_cuenta_corriente");
