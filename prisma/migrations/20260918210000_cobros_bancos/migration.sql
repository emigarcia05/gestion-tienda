-- Catálogo de bancos Cx. Fin. Cobros.

CREATE TABLE "cobros_bancos" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cobros_bancos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cobros_bancos_nombre_key" ON "cobros_bancos"("nombre");
CREATE INDEX "cobros_bancos_orden_idx" ON "cobros_bancos"("orden");
