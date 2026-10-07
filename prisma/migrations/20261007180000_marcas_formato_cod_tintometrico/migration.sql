-- Formato de código tintométrico pasa a una columna de prod_marcas (un formato por marca).
ALTER TABLE "prod_marcas" ADD COLUMN IF NOT EXISTS "formato_cod_tintometrico" TEXT;

DROP TABLE IF EXISTS "tintometrico_marcas";
