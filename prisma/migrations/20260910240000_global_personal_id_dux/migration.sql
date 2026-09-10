-- id_dux: vínculo DUX de global_personal. Filas actuales: copia de id_personal.
-- Altas nuevas: el usuario lo carga (opcional). Unique si no es NULL.

ALTER TABLE "global_personal"
ADD COLUMN "id_dux" TEXT;

UPDATE "global_personal"
SET "id_dux" = "id_personal"::text
WHERE "id_dux" IS NULL;

CREATE UNIQUE INDEX "global_personal_id_dux_key"
ON "global_personal"("id_dux");
