# Producción: Supabase Cloud + Vercel + dominio

Orden recomendado. Los pasos 1, 3 y 4 los haces tú (cuentas y cobros); el resto lo hago yo con lo que me pases.

## 1. Supabase Cloud (plan Pro, USD 25/mes)

1. supabase.com → New project. Nombre `fidelitap`, región **South America (São Paulo)** (la más cercana a Colombia), contraseña de base de datos fuerte (guárdala).
2. Cuando esté listo: Project Settings → API → copia **Project URL**, **anon key** y **service_role key**.
3. En una terminal de esta Mac, una sola vez:
   ```bash
   pnpm supabase login
   pnpm supabase link --project-ref <REF_DEL_PROYECTO>
   pnpm supabase db push
   ```
   `db push` aplica las 33 migraciones. El `<REF_DEL_PROYECTO>` es el código de la URL (`https://<REF>.supabase.co`).
4. Authentication → Providers → Email: activa "Confirm email" si quieres que los dueños confirmen su correo. Authentication → URL Configuration: Site URL `https://fidelitap.co`.
5. Authentication → SMTP: usa Resend (SMTP `smtp.resend.com`, usuario `resend`, contraseña = tu API key) una vez verificado el dominio.
6. Storage: confirma que existen los buckets de logos y fondos (las migraciones los crean).

## 2. Vercel (plan Pro, USD 20/mes por persona)

El plan gratuito (Hobby) es solo para uso no comercial y limita los cron a una vez al día; las campañas programadas necesitan correr cada 5 minutos (`vercel.json`), así que para producción hace falta Pro.

1. vercel.com → Add New → Project → importa `ssamueldavidp/fidelitap`. Framework: Next.js (se detecta solo).
2. En Settings → Environment Variables agrega estas variables (valores: los de `.env.local`, salvo lo marcado):

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://fidelitap.co` |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | **los de Supabase Cloud** (paso 1), no los locales |
| `MP_ACCESS_TOKEN` / `MP_PUBLIC_KEY` / `MP_WEBHOOK_SECRET` | credenciales de MercadoPago **de producción** cuando salgas a cobrar; las actuales son de prueba |
| `MP_SANDBOX_PAYER_EMAIL` | solo en pruebas; **no** la pongas en producción |
| `RESEND_API_KEY` | la de Resend |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | JSON de la cuenta de servicio de Firebase (proyecto `fidelitap-f6648`) |
| `GOOGLE_WALLET_ISSUER_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_KEY` | las de Google Wallet |
| `VAPID_PUBLIC_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | las de Web Push |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | las de Upstash |
| `APP_HMAC_SECRET` | un secreto largo nuevo (no reutilices el de desarrollo) |
| `CRON_SECRET` | un secreto largo nuevo; Vercel lo envía solo a los cron |
| `APPLE_*` (7 variables) | cuando tengas Apple Developer; por ahora puedes omitirlas |

3. Deploy. Los cron de `vercel.json` se activan solos.

## 3. Dominio fidelitap.co (Hostinger → Vercel)

1. Vercel → Project → Settings → Domains → agrega `fidelitap.co` y `www.fidelitap.co`.
2. Hostinger → Dominios → DNS: registro **A** `@` → `76.76.21.21` y **CNAME** `www` → `cname.vercel-dns.com` (Vercel te muestra los valores exactos; usa esos).
3. Espera la propagación (minutos a unas horas) y verifica el candado HTTPS.

## 4. Después de que el sitio esté en línea

- MercadoPago → Webhooks: URL `https://fidelitap.co/api/webhooks/mercadopago`; marca **Pagos** y **Planes y suscripciones**.
- Google Wallet: cambia en el perfil el sitio web, correo y URL de soporte por los del dominio real y pide el acceso de publicación.
- Resend: verifica el dominio `fidelitap.co` (registros DNS en Hostinger) y define `RESEND_FROM`.
- Actualiza los secrets de GitHub de la app móvil (`API_BASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`) y compila la app: ver `docs/app-movil-publicacion.md`.
