# Documentación (retroalimentación IA)

| Documento | Cuándo leerlo |
|-----------|---------------|
| [FRONTEND_GUIDELINES.md](./FRONTEND_GUIDELINES.md) | UI / componentes / estilos — **tabla “Qué estás haciendo” al inicio** + sección del patrón o módulo; no el archivo entero |
| [BACKEND_GUIDELINES.md](./BACKEND_GUIDELINES.md) | Actions / servicios / Prisma — **tabla “Qué estás haciendo” al inicio** + § del dominio o principio |
| [AGENTEIA_GUIDELINES.md](./AGENTEIA_GUIDELINES.md) | IA Diseño: capas, CSV, scraper, UI Asistente IA |
| [IA_DISEÑO/](./IA_DISEÑO/) | Índice del módulo, reglas, prompt GPT, ADRs, CSVs |

Prompts operativos de agentes (FullStack / Front / Back / **ARCA-AFIP** / Auditoría / Auditor BackEnd): [`.cursor/prompts.md`](../.cursor/prompts.md).

---

## Flujo de trabajo full stack

1. Entender objetivo y restricciones funcionales.
2. Diseñar el contrato de datos (Zod + tipos de respuesta `ActionResult`) **antes** de la UI.
3. Implementar en este orden preferido:
   - Prisma / servicios en `src/services/`
   - Server Actions en `src/actions/` (sesión, rol, Zod; sin lógica de negocio pesada)
   - UI en `src/app/` + componentes (tokens shadcn, `cn()`, patrones documentados)
4. Verificar regresiones básicas del flujo tocado.
5. Cerrar con retroalimentación documental (obligatorio):
   - Nuevo/ajustado patrón UI → [FRONTEND_GUIDELINES.md](./FRONTEND_GUIDELINES.md)
   - Nuevo/ajustado servicio, esquema o regla → [BACKEND_GUIDELINES.md](./BACKEND_GUIDELINES.md)
   - IA Diseño → [AGENTEIA_GUIDELINES.md](./AGENTEIA_GUIDELINES.md) y/o [IA_DISEÑO/CHANGELOG.md](./IA_DISEÑO/CHANGELOG.md) (ADR si cambia arquitectura)

### Reglas técnicas (resumen)

- TypeScript estricto; prohibido `any`.
- Estilos: tokens shadcn + `cn()` de `@/lib/utils`; no inventar clases globales sin documentarlas.
- Filtros: `useFiltrosConBusqueda` + `FiltroBusquedaInput` cuando aplique.
- Tablas: `Table` de `@/components/ui/table`; layouts `ClassicFilteredTableLayout` / `ClassicPageHeader` si el módulo ya los usa.
- Auth: iron-session y helpers del proyecto; checklist de seguridad en BACKEND_GUIDELINES (§1.2.x).
- Lógica de negocio en servicios, no en la UI ni embutida en actions.
- Cambios estructurales grandes: preguntar antes de aplicar.
- Lint: `npx eslint src --max-warnings 0` debe pasar.

### Criterio de hecho

Código estable + flujo verificado + guías actualizadas según este README. **Sin documentación alineada, la tarea permanece incompleta.**

Reglas persistentes en Cursor: `.cursor/rules/manuales-obligatorios.mdc` y `.cursor/rules/flujo-fullstack-end-to-end.mdc`.

---

## IA Diseño — lectura mínima

1. [AGENTEIA_GUIDELINES.md](./AGENTEIA_GUIDELINES.md)
2. [REGLAS_NEGOCIO.md](./IA_DISEÑO/REGLAS_NEGOCIO.md) si cambia el comportamiento del asesor
3. ADRs `001` / `002` / `004` / `005` si cambia arquitectura

CSV para cargar a un GPT: **`IA_DISEÑO/colores_alba_ia.csv`**.

```bash
npm run ia-diseno:pipeline
```
