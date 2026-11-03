-- Pedir Mercadería: el proveedor sale si pedido_urgente = true
-- y admite pedido de reposición y pedido urgente.
-- Los que ya se listaban (mercadería, no fábrica) quedan en true.
ALTER TABLE "proveedores" ADD COLUMN "pedido_urgente" BOOLEAN NOT NULL DEFAULT false;

UPDATE "proveedores"
SET "pedido_urgente" = true
WHERE "proveedor_mercaderia" = true
  AND "es_fabrica" = false;

CREATE INDEX "proveedores_pedido_urgente_idx" ON "proveedores"("pedido_urgente");

ALTER TABLE "proveedores"
  ADD CONSTRAINT "proveedores_es_fabrica_pedido_urgente_check"
  CHECK ("es_fabrica" = false OR "pedido_urgente" = false);
