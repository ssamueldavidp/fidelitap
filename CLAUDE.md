## Learnings (added by /aprende)

- `@resvg/resvg-js` requiere `experimental.serverComponentsExternalPackages: ['@resvg/resvg-js']` en `next.config.mjs`. Sin esto webpack no puede bundlear el binario nativo y falla en producción silenciosamente. <!-- /aprende 2026-05-19 -->
- Todas las queries de `loyalty_cards` deben incluir `.is('deleted_at', null)`. El proyecto usa soft-delete con columna `deleted_at`; omitir el filtro expone tarjetas eliminadas al usuario y al API. <!-- /aprende 2026-05-19 -->
