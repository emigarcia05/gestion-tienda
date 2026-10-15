-- Acabado opcional de cada ítem de `prod_lista` (BRILLANTE / SATINADO / MATE; null = vacío).

CREATE TYPE "TerminacionProdLista" AS ENUM ('BRILLANTE', 'SATINADO', 'MATE');

ALTER TABLE "prod_lista" ADD COLUMN "terminacion" "TerminacionProdLista";
