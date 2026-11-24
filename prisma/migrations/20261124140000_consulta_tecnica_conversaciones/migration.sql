-- Hilos de Consulta Técnica. El tipo de hoy es TECNICA. El usuario es quien abrió el hilo.

CREATE TABLE "consulta_tecnica_conversaciones" (
    "id" TEXT NOT NULL,
    "tipo" VARCHAR(40) NOT NULL,
    "personal_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consulta_tecnica_conversaciones_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "consulta_tecnica_conversaciones_tipo_chk" CHECK ("tipo" = 'TECNICA')
);

CREATE INDEX "consulta_tecnica_conversaciones_updated_idx"
    ON "consulta_tecnica_conversaciones"("updated_at");

CREATE INDEX "consulta_tecnica_conversaciones_personal_idx"
    ON "consulta_tecnica_conversaciones"("personal_id");

ALTER TABLE "consulta_tecnica_conversaciones"
    ADD CONSTRAINT "consulta_tecnica_conversaciones_personal_id_fkey"
    FOREIGN KEY ("personal_id") REFERENCES "usuarios"("id_personal")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "consulta_tecnica_mensajes" (
    "id" TEXT NOT NULL,
    "conversacion_id" TEXT NOT NULL,
    "autor" VARCHAR(16) NOT NULL,
    "texto" VARCHAR(2000) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consulta_tecnica_mensajes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "consulta_tecnica_mensajes_autor_chk" CHECK ("autor" = 'USUARIO'),
    CONSTRAINT "consulta_tecnica_mensajes_texto_chk" CHECK (length(btrim("texto")) > 0)
);

CREATE INDEX "consulta_tecnica_mensajes_conversacion_created_idx"
    ON "consulta_tecnica_mensajes"("conversacion_id", "created_at");

ALTER TABLE "consulta_tecnica_mensajes"
    ADD CONSTRAINT "consulta_tecnica_mensajes_conversacion_id_fkey"
    FOREIGN KEY ("conversacion_id") REFERENCES "consulta_tecnica_conversaciones"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
