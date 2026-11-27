-- Prioridad de venta de Comp. Categorías: familias de prod_familias, por subcategoría.

CREATE TABLE "prod_comp_familias" (
    "id" TEXT NOT NULL,
    "subcategoria_id" TEXT NOT NULL,
    "familia_id" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prod_comp_familias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "prod_comp_familias_sub_familia_ux" ON "prod_comp_familias"("subcategoria_id", "familia_id");
CREATE UNIQUE INDEX "prod_comp_familias_sub_orden_ux" ON "prod_comp_familias"("subcategoria_id", "orden");
CREATE INDEX "prod_comp_familias_familia_id_idx" ON "prod_comp_familias"("familia_id");

ALTER TABLE "prod_comp_familias" ADD CONSTRAINT "prod_comp_familias_subcategoria_id_fkey" FOREIGN KEY ("subcategoria_id") REFERENCES "prod_comp_sub_cat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "prod_comp_familias" ADD CONSTRAINT "prod_comp_familias_familia_id_fkey" FOREIGN KEY ("familia_id") REFERENCES "prod_familias"("id") ON DELETE CASCADE ON UPDATE CASCADE;
