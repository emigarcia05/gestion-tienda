-- Listado Px Listas: ORDER BY descripcion + DISTINCT/filtros marca/rubro/sub_rubro.
CREATE INDEX IF NOT EXISTS "prod_tienda_descripcion_tienda_idx"
ON "prod_tienda" ("descripcion_tienda");

CREATE INDEX IF NOT EXISTS "prod_tienda_marca_idx"
ON "prod_tienda" ("marca");

CREATE INDEX IF NOT EXISTS "prod_tienda_rubro_idx"
ON "prod_tienda" ("rubro");

CREATE INDEX IF NOT EXISTS "prod_tienda_sub_rubro_idx"
ON "prod_tienda" ("sub_rubro");
