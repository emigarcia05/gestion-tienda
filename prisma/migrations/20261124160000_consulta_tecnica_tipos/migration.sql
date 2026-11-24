-- Tipos de consulta y autor del instructivo. TECNICA y USUARIO siguen valiendo.

ALTER TABLE "consulta_tecnica_conversaciones"
    DROP CONSTRAINT "consulta_tecnica_conversaciones_tipo_chk";

ALTER TABLE "consulta_tecnica_conversaciones"
    ADD CONSTRAINT "consulta_tecnica_conversaciones_tipo_chk" CHECK (
        "tipo" IN ('TECNICA', 'FICHA_ITEM', 'RECOMENDAR', 'MANUAL')
    );

ALTER TABLE "consulta_tecnica_mensajes"
    DROP CONSTRAINT "consulta_tecnica_mensajes_autor_chk";

ALTER TABLE "consulta_tecnica_mensajes"
    ADD CONSTRAINT "consulta_tecnica_mensajes_autor_chk" CHECK (
        "autor" IN ('USUARIO', 'SISTEMA')
    );
