-- PK interno: el alta ya no pide id_personal; lo asigna la secuencia.
CREATE SEQUENCE IF NOT EXISTS "global_personal_id_personal_seq";

SELECT setval(
  'global_personal_id_personal_seq',
  COALESCE((SELECT MAX("id_personal") FROM "global_personal"), 1),
  true
);

ALTER TABLE "global_personal"
  ALTER COLUMN "id_personal" SET DEFAULT nextval('global_personal_id_personal_seq');

ALTER SEQUENCE "global_personal_id_personal_seq" OWNED BY "global_personal"."id_personal";
