-- clientes_proyectos: calle_nombre + numeracion → direccion ("calle_nombre numeracion").
-- Idempotente: si las columnas viejas ya no existen, no hace nada.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'clientes_proyectos'
      AND column_name = 'calle_nombre'
  ) THEN
    ALTER TABLE "clientes_proyectos" ADD COLUMN IF NOT EXISTS "direccion" TEXT NOT NULL DEFAULT '';

    UPDATE "clientes_proyectos"
    SET "direccion" = concat_ws(
      ' ',
      NULLIF(btrim("calle_nombre"), ''),
      NULLIF(btrim("numeracion"), '')
    );

    ALTER TABLE "clientes_proyectos" ALTER COLUMN "direccion" DROP DEFAULT;

    ALTER TABLE "clientes_proyectos" DROP CONSTRAINT IF EXISTS "clientes_proyectos_al_menos_un_dato_chk";
    DROP INDEX IF EXISTS "clientes_proyectos_calle_nombre_idx";

    ALTER TABLE "clientes_proyectos" DROP COLUMN "calle_nombre";
    ALTER TABLE "clientes_proyectos" DROP COLUMN "numeracion";
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "clientes_proyectos_direccion_idx" ON "clientes_proyectos"("direccion");

ALTER TABLE "clientes_proyectos" DROP CONSTRAINT IF EXISTS "clientes_proyectos_al_menos_un_dato_chk";
ALTER TABLE "clientes_proyectos"
ADD CONSTRAINT "clientes_proyectos_al_menos_un_dato_chk"
CHECK (
  btrim("nombre_proyecto") <> ''
  OR btrim("direccion") <> ''
  OR btrim("distrito") <> ''
  OR "departamento" IS NOT NULL
  OR ("url_maps" IS NOT NULL AND btrim("url_maps") <> '')
  OR ("referencia" IS NOT NULL AND btrim("referencia") <> '')
);
