-- Catálogo ARCA: condiciones frente al IVA (lookup / parámetros).
CREATE TABLE IF NOT EXISTS "pto_ventas_cod_arca" (
  "id" SERIAL NOT NULL,
  "codigo" INTEGER NOT NULL,
  "descripcion" VARCHAR(100) NOT NULL,
  "activo" BOOLEAN NOT NULL DEFAULT true,

  CONSTRAINT "pto_ventas_cod_arca_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "pto_ventas_cod_arca_codigo_key"
ON "pto_ventas_cod_arca" ("codigo");

-- Seed códigos oficiales ARCA (idempotente por `codigo`).
INSERT INTO "pto_ventas_cod_arca" ("codigo", "descripcion", "activo")
VALUES
  (1, 'IVA Responsable Inscripto', true),
  (4, 'IVA Sujeto Exento', true),
  (5, 'Consumidor Final', true),
  (6, 'Responsable Monotributo', true),
  (8, 'Proveedor del Exterior', true),
  (9, 'Cliente del Exterior', true),
  (13, 'Monotributista Social', true)
ON CONFLICT ("codigo") DO UPDATE
SET
  "descripcion" = EXCLUDED."descripcion",
  "activo" = EXCLUDED."activo";
