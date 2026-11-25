-- Foto adjunta a un mensaje de Consulta Técnica. El listado no lee `imagen`.

ALTER TABLE "consulta_tecnica_mensajes"
    ADD COLUMN "imagen_mime" VARCHAR(40),
    ADD COLUMN "imagen" BYTEA;
