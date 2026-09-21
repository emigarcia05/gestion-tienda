-- Catálogo de titulares de tesorería (`tesoreria_titulares`).
-- `nombre_completo` único en MAYÚSCULAS. No reemplaza aún `fin_tesoreria.titular` ni `fin_tesoreria_cheques.tenedor`.

CREATE TABLE "tesoreria_titulares" (
    "id" TEXT NOT NULL,
    "nombre_completo" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tesoreria_titulares_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tesoreria_titulares_nombre_completo_key" ON "tesoreria_titulares"("nombre_completo");

INSERT INTO "tesoreria_titulares" ("id", "nombre_completo", "created_at", "updated_at")
SELECT gen_random_uuid()::text, n.nombre, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT upper(trim(src.nombre)) AS nombre
    FROM (
        SELECT "titular" AS nombre FROM "fin_tesoreria"
        UNION ALL
        SELECT "tenedor" FROM "fin_tesoreria_cheques"
        UNION ALL
        SELECT "nombre_personal" FROM "global_personal" WHERE "titular_financiero" = true
    ) AS src
    WHERE src.nombre IS NOT NULL AND trim(src.nombre) <> ''
) AS n;
