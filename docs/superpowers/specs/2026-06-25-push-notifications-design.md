# Push Notifications & Campañas — Diseño

**Fecha:** 2026-06-25
**Estado:** Aprobado, pendiente de plan de implementación

## Resumen

Añadir notificaciones Web Push para clientes con tarjeta activa, exclusivas de los planes **Pro** y **Premium**. Tres tipos de notificación:

1. **Progreso de sellos** — automática, cuando el cliente llega al umbral configurado por el negocio (ej. "te falta 1 sello").
2. **Re-engagement** — automática, recordatorio único tras 14 días de inactividad.
3. **Campaña manual** — el negocio crea y envía (inmediato o programado) mensajes de marketing (descuentos, promos) a sus clientes.

Se descartó el geofencing en tiempo real: los navegadores no permiten vigilar la ubicación en segundo plano, y los clientes de Fidelitap no navegan una página web recurrente (viven en Apple/Google Wallet tras activar). La geolocalización queda **fuera de alcance** en esta fase.

## Arquitectura

- **Web Push API** estándar (`web-push` npm package en el servidor) + **VAPID keys**.
- **Service Worker** en `public/sw.js`: escucha el evento `push`, muestra la notificación; escucha `notificationclick` para abrir una URL.
- El cliente se suscribe **una sola vez, de forma opcional**, en `success-screen.tsx` tras activar su tarjeta — solo si el negocio es plan Pro/Premium. Si rechaza o ignora, no se vuelve a insistir.
- Envío real ocurre server-side desde Next.js API routes usando las claves VAPID privadas.

## Modelo de datos

### Tabla nueva: `push_subscriptions`

```sql
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_card_id uuid not null references customer_cards(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create unique index on push_subscriptions (endpoint);
create index on push_subscriptions (customer_card_id);
create index on push_subscriptions (business_id) where active;
```

### Tabla nueva: `push_campaigns`

```sql
create table push_campaigns (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  loyalty_card_id uuid references loyalty_cards(id) on delete cascade, -- null = todas las tarjetas del negocio
  title text not null,
  body text not null,
  scheduled_at timestamptz, -- null = enviar inmediatamente al crear
  sent_at timestamptz,
  status text not null default 'draft' check (status in ('draft','scheduled','sent','failed')),
  recipients_count int,
  created_at timestamptz not null default now()
);
create index on push_campaigns (business_id);
create index on push_campaigns (status, scheduled_at) where status = 'scheduled';
```

### Columnas nuevas en tablas existentes

```sql
alter table loyalty_cards
  add column push_notify_threshold int not null default 1; -- avisar cuando falten N sellos

alter table customer_cards
  add column near_completion_notified_at timestamptz, -- evita duplicar aviso en el mismo ciclo
  add column last_stamp_at timestamptz; -- base para el cálculo de inactividad de 14 días
```

`near_completion_notified_at` se resetea a `null` cuando el ciclo se completa (en `claim_reward` RPC o en `claimRewardAction`), para que el siguiente ciclo pueda notificar de nuevo.

`last_stamp_at` se actualiza en `add_stamp` RPC (o en `addStampAction` justo después del insert exitoso).

RLS: ambas tablas siguen el patrón existente — el negocio solo puede leer/escribir filas donde `business_id = (select id from businesses where owner_id = auth.uid())`. `push_subscriptions` se inserta vía Service Role (no expuesta a RLS de cliente, ya que el endpoint de suscripción usa `createServiceClient()` tras validar el `wallet_auth_token`).

## Flujo de suscripción (cliente)

1. Cliente activa su tarjeta → ve `success-screen.tsx`.
2. Si `business.plan` es `pro` o `premium`, se muestra una tarjeta discreta: *"🔔 Recibe un aviso cuando estés cerca de tu premio"* con un botón "Activar".
3. Al hacer clic: registrar `public/sw.js`, pedir permiso de `Notification`, llamar `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VAPID_PUBLIC_KEY })`.
4. POST a `/api/push/subscribe` con `{ customerCardId, walletAuthToken, subscription }`. El endpoint valida el `wallet_auth_token` contra `customer_cards` antes de guardar (mismo patrón de autenticación que ya usa el resto del flujo de cliente).
5. Si el cliente rechaza el permiso del navegador o cierra el prompt, se guarda un flag en `localStorage` (`push_prompt_dismissed`) para no volver a mostrarlo en esa sesión/dispositivo.

## Triggers automáticos

### Progreso de sellos

En `addStampAction` (`src/app/(dashboard)/scanner/actions.ts`), después de calcular `currentStamps`, `stampsRequired` e `isComplete`:

```
remaining = stampsRequired - currentStamps
if (!isComplete && remaining === card.push_notify_threshold && !cc.near_completion_notified_at):
    enviar push "¡Ya casi! Te falta(n) {remaining} sello(s) para tu premio en {business.name}"
    marcar near_completion_notified_at = now()
```

Se ejecuta en el mismo `Promise.allSettled` que ya dispara APNS/Google Wallet/email — no bloquea la respuesta al negocio.

### Re-engagement (14 días)

Job diario disparado por `pg_cron` → `POST /api/push/jobs/reengagement` (protegido por `CRON_SECRET`).

Para evitar reenvíos en bucle se añade una columna nueva:

```sql
alter table customer_cards add column reengagement_sent_at timestamptz;
```

El job selecciona candidatos así:

```sql
select * from customer_cards
where status = 'active'
  and last_stamp_at < now() - interval '14 days'
  and (reengagement_sent_at is null or reengagement_sent_at < last_stamp_at)
```

La condición `reengagement_sent_at < last_stamp_at` permite un nuevo recordatorio si el cliente volvió a sellar después del último aviso y luego cayó otra vez en inactividad. Tras enviar, se marca `reengagement_sent_at = now()`. Solo aplica a negocios con plan Pro/Premium vigente (`subscription_status = 'active'`).

### Campaña manual

El negocio crea la campaña desde el dashboard. Si `scheduled_at` es null, se envía inmediatamente al guardar (status pasa de `draft` a `sent` en la misma request). Si tiene `scheduled_at` futuro, queda en `status = 'scheduled'` y la despacha el cron de minuto a minuto.

Audiencia: todas las `push_subscriptions` activas de `customer_cards` que pertenecen a `loyalty_card_id` (o a cualquier tarjeta del negocio si `loyalty_card_id` es null).

## Dashboard de campañas

Nueva ruta `/campaigns` en `src/app/(dashboard)/campaigns/`.

- **Free/Basic:** pantalla de upsell — "Las campañas push están disponibles en los planes Pro y Premium" con link a `/settings?tab=suscripcion`.
- **Pro/Premium:** formulario (título, mensaje, selector de tarjeta, fecha/hora opcional) + lista de campañas pasadas con su estado y conteo de destinatarios.

## Mecanismo de envío programado (cron)

Migración de Supabase habilita `pg_cron` y `pg_net`:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'dispatch-push-campaigns',
  '* * * * *', -- cada minuto
  $$
  select net.http_post(
    url := current_setting('app.settings.app_url') || '/api/push/campaigns/dispatch',
    headers := jsonb_build_object('x-cron-secret', current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'reengagement-reminders',
  '0 14 * * *', -- 9am Colombia (UTC-5) una vez al día
  $$
  select net.http_post(
    url := current_setting('app.settings.app_url') || '/api/push/jobs/reengagement',
    headers := jsonb_build_object('x-cron-secret', current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  );
  $$
);
```

Ambos endpoints (`/api/push/campaigns/dispatch`, `/api/push/jobs/reengagement`) verifican el header `x-cron-secret` contra `process.env.CRON_SECRET` antes de ejecutar nada. Responden 401 si no coincide.

## Endpoints nuevos

| Ruta | Método | Quién llama | Gating |
|---|---|---|---|
| `/api/push/subscribe` | POST | Cliente (público, valida `wallet_auth_token`) | Plan pro/premium del negocio |
| `/api/push/unsubscribe` | POST | Cliente | — |
| `/api/push/campaigns` | GET/POST | Dashboard negocio (auth) | Plan pro/premium |
| `/api/push/campaigns/[id]` | DELETE | Dashboard negocio (auth) | Plan pro/premium, solo si `status='scheduled'` |
| `/api/push/campaigns/dispatch` | POST | pg_cron (interno) | `CRON_SECRET` |
| `/api/push/jobs/reengagement` | POST | pg_cron (interno) | `CRON_SECRET` |

## Seguridad

- `VAPID_PRIVATE_KEY` y `CRON_SECRET` solo en `.env.local`, nunca en el cliente. El módulo `src/lib/push/send.ts` que los usa lleva `import 'server-only'`.
- `VAPID_PUBLIC_KEY` sí se expone al cliente (es pública por diseño del protocolo Web Push) vía `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
- Suscripciones que el servicio push rechaza con `410 Gone` (endpoint expirado/desinstalado) se marcan `active = false` en el mismo intento de envío, para no seguir intentando.
- Plan-gating verificado en cada punto de envío (no solo en la UI): si el negocio bajó de plan o se le venció la suscripción, los triggers automáticos y el envío de campañas se saltan silenciosamente esa tarjeta/negocio.

## Fuera de alcance (explícitamente descartado)

- Geofencing en tiempo real (background location). No es viable con tecnología web; requeriría app nativa.
- Captura de ubicación del cliente y segmentación de campañas por cercanía — descartado tras discusión, se puede revisar en una fase futura si se construye una superficie web que el cliente visite recurrentemente.
- Umbral de re-engagement configurable por negocio — fijo a 14 días en esta fase.

## Testing

- Verificar que el Service Worker se registra y la suscripción se guarda correctamente en `push_subscriptions`.
- Verificar que `addStampAction` dispara el push de progreso exactamente una vez por ciclo (no se duplica en sellos subsecuentes).
- Verificar que el reseteo de `near_completion_notified_at` ocurre al reclamar el premio.
- Verificar que el cron de campañas programadas las envía a la hora correcta y actualiza `status` a `sent`.
- Verificar que negocios free/basic no pueden disparar ningún push (ni automático ni manual) aunque manipulen el request directamente.
- Verificar manejo de `410 Gone` marcando la suscripción inactiva.
