-- nombre_proyecto no vacío: backfill PRINCIPAL + default + CHECK.

UPDATE "clientes_proyectos"
SET "nombre_proyecto" = 'PRINCIPAL'
WHERE btrim("nombre_proyecto") = '';

ALTER TABLE "clientes_proyectos"
  ALTER COLUMN "nombre_proyecto" SET DEFAULT 'PRINCIPAL';

ALTER TABLE "clientes_proyectos"
  DROP CONSTRAINT IF EXISTS "clientes_proyectos_nombre_proyecto_chk";

ALTER TABLE "clientes_proyectos"
  ADD CONSTRAINT "clientes_proyectos_nombre_proyecto_chk"
  CHECK (btrim("nombre_proyecto") <> '');
