-- FK fin_vtas_cobros.id_sucursal → global_sucursales.id_dux.
-- Mismo tipo (TEXT) y unique en id_dux (varios NULL permitidos: corporativo).

CREATE UNIQUE INDEX IF NOT EXISTS "global_sucursales_id_dux_key"
ON "global_sucursales" ("id_dux");

ALTER TABLE "fin_vtas_cobros"
  ALTER COLUMN "id_sucursal" TYPE TEXT USING "id_sucursal"::text;

DELETE FROM "fin_vtas_cobros" AS f
WHERE NOT EXISTS (
  SELECT 1
  FROM "global_sucursales" AS s
  WHERE s."id_dux" IS NOT NULL
    AND s."id_dux" = f."id_sucursal"
);

ALTER TABLE "fin_vtas_cobros"
  ADD CONSTRAINT "fin_vtas_cobros_id_sucursal_fkey"
  FOREIGN KEY ("id_sucursal") REFERENCES "global_sucursales"("id_dux")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
