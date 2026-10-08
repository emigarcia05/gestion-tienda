-- Catálogos de productos propios:
--   prod_rubros_lista            -> prod_rubros
--   est_por_prod_colores         -> prod_colores
--   est_por_prod_presentacion    -> prod_presentaciones
--   est_por_prod_un_presentacion -> prod_presentaciones_unidades
--   + prod_sub_rubros (1 rubro -> N sub-rubros)
-- prod_propios: id_rubro / id_sub_rubro (FK compuesta), sin textos rubro / sub_rubro / marca.

-- 1) Renombre de tablas y sus constraints / índices
ALTER TABLE "prod_rubros_lista" RENAME TO "prod_rubros";
ALTER TABLE "prod_rubros" RENAME CONSTRAINT "prod_rubros_lista_pkey" TO "prod_rubros_pkey";
ALTER INDEX "prod_rubros_lista_nombre_key" RENAME TO "prod_rubros_nombre_key";

ALTER TABLE "est_por_prod_colores" RENAME TO "prod_colores";
ALTER TABLE "prod_colores" RENAME CONSTRAINT "est_por_prod_colores_pkey" TO "prod_colores_pkey";
ALTER INDEX "est_por_prod_colores_nombre_key" RENAME TO "prod_colores_nombre_key";

ALTER TABLE "est_por_prod_un_presentacion" RENAME TO "prod_presentaciones_unidades";
ALTER TABLE "prod_presentaciones_unidades" RENAME CONSTRAINT "est_por_prod_un_presentacion_pkey" TO "prod_presentaciones_unidades_pkey";
ALTER INDEX "est_por_prod_un_presentacion_unidad_key" RENAME TO "prod_presentaciones_unidades_unidad_key";

ALTER TABLE "est_por_prod_presentacion" RENAME TO "prod_presentaciones";
ALTER TABLE "prod_presentaciones" RENAME CONSTRAINT "est_por_prod_presentacion_pkey" TO "prod_presentaciones_pkey";
ALTER TABLE "prod_presentaciones" RENAME CONSTRAINT "est_por_prod_presentacion_unidad_medida_id_fkey" TO "prod_presentaciones_unidad_medida_id_fkey";
ALTER TABLE "prod_presentaciones" RENAME CONSTRAINT "est_por_prod_presentacion_conversion_a_unidad_id_fkey" TO "prod_presentaciones_conversion_a_unidad_id_fkey";
ALTER INDEX "est_por_prod_presentacion_texto_key" RENAME TO "prod_presentaciones_texto_key";
ALTER INDEX "est_por_prod_presentacion_unidad_medida_id_idx" RENAME TO "prod_presentaciones_unidad_medida_id_idx";
ALTER INDEX "est_por_prod_presentacion_conversion_a_unidad_id_idx" RENAME TO "prod_presentaciones_conversion_a_unidad_id_idx";

-- 2) Sub-rubros
CREATE TABLE "prod_sub_rubros" (
  "id"         TEXT         NOT NULL,
  "id_rubro"   TEXT         NOT NULL,
  "nombre"     TEXT         NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "prod_sub_rubros_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "prod_sub_rubros_id_rubro_nombre_key" ON "prod_sub_rubros" ("id_rubro", "nombre");
CREATE UNIQUE INDEX "prod_sub_rubros_id_id_rubro_key" ON "prod_sub_rubros" ("id", "id_rubro");
CREATE INDEX "prod_sub_rubros_id_rubro_idx" ON "prod_sub_rubros" ("id_rubro");
ALTER TABLE "prod_sub_rubros"
  ADD CONSTRAINT "prod_sub_rubros_id_rubro_fkey"
  FOREIGN KEY ("id_rubro") REFERENCES "prod_rubros" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3) Columnas FK en prod_propios
ALTER TABLE "prod_propios" ADD COLUMN "id_rubro" TEXT;
ALTER TABLE "prod_propios" ADD COLUMN "id_sub_rubro" TEXT;

-- 4) Backfill desde los textos actuales
-- 4a) Rubros faltantes en el catálogo (hoy no hay, por seguridad)
INSERT INTO "prod_rubros" ("id", "nombre", "updated_at")
SELECT gen_random_uuid()::text, x.nombre, CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT upper(trim(p.rubro)) AS nombre FROM "prod_propios" p
  WHERE nullif(trim(p.rubro), '') IS NOT NULL
) x
WHERE NOT EXISTS (SELECT 1 FROM "prod_rubros" r WHERE upper(trim(r.nombre)) = x.nombre);

UPDATE "prod_propios" p
SET "id_rubro" = r.id
FROM "prod_rubros" r
WHERE nullif(trim(p.rubro), '') IS NOT NULL AND upper(trim(r.nombre)) = upper(trim(p.rubro));

-- 4b) Sub-rubros desde los pares rubro + sub_rubro existentes
INSERT INTO "prod_sub_rubros" ("id", "id_rubro", "nombre", "updated_at")
SELECT gen_random_uuid()::text, x.id_rubro, x.nombre, CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT p.id_rubro, upper(trim(p.sub_rubro)) AS nombre FROM "prod_propios" p
  WHERE p.id_rubro IS NOT NULL AND nullif(trim(p.sub_rubro), '') IS NOT NULL
) x;

UPDATE "prod_propios" p
SET "id_sub_rubro" = s.id
FROM "prod_sub_rubros" s
WHERE s.id_rubro = p.id_rubro AND s.nombre = upper(trim(p.sub_rubro));

-- 4c) Marcas: asegurar id_marca donde solo había texto
INSERT INTO "prod_marcas" ("id", "nombre", "updated_at")
SELECT gen_random_uuid()::text, x.nombre, CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT upper(trim(p.marca)) AS nombre FROM "prod_propios" p
  WHERE p.id_marca IS NULL AND nullif(trim(p.marca), '') IS NOT NULL
) x
WHERE NOT EXISTS (SELECT 1 FROM "prod_marcas" m WHERE upper(trim(m.nombre)) = x.nombre);

UPDATE "prod_propios" p
SET "id_marca" = m.id
FROM "prod_marcas" m
WHERE p.id_marca IS NULL AND nullif(trim(p.marca), '') IS NOT NULL AND upper(trim(m.nombre)) = upper(trim(p.marca));

-- 5) FKs e índices nuevos
ALTER TABLE "prod_propios"
  ADD CONSTRAINT "prod_propios_id_rubro_fkey"
  FOREIGN KEY ("id_rubro") REFERENCES "prod_rubros" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "prod_propios"
  ADD CONSTRAINT "prod_propios_id_sub_rubro_id_rubro_fkey"
  FOREIGN KEY ("id_sub_rubro", "id_rubro") REFERENCES "prod_sub_rubros" ("id", "id_rubro") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "prod_propios_id_rubro_idx" ON "prod_propios" ("id_rubro");
CREATE INDEX "prod_propios_id_sub_rubro_idx" ON "prod_propios" ("id_sub_rubro");
CREATE INDEX IF NOT EXISTS "prod_propios_id_marca_idx" ON "prod_propios" ("id_marca");

-- 6) Trigger de mayúsculas sin las columnas que se eliminan
CREATE OR REPLACE FUNCTION fn_uppercase_precios_tienda()
RETURNS TRIGGER AS $$
BEGIN
  NEW.cod_tienda := public.upper_trim_or_null(NEW.cod_tienda);
  NEW.proveedor := public.upper_trim_or_null(NEW.proveedor);
  NEW.descripcion_tienda := public.upper_trim_or_null(NEW.descripcion_tienda);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7) Eliminar textos espejo (sus índices caen con la columna)
ALTER TABLE "prod_propios" DROP COLUMN "rubro";
ALTER TABLE "prod_propios" DROP COLUMN "sub_rubro";
ALTER TABLE "prod_propios" DROP COLUMN "marca";
