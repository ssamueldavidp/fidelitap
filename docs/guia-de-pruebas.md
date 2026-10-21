# Guía de pruebas (entorno local + ngrok)

URL pública de pruebas: la de `NEXT_PUBLIC_APP_URL` en `.env.local` (hoy `https://frail-enunciate-eatery.ngrok-free.dev`). Si ngrok se reinicia la URL cambia: actualiza `NEXT_PUBLIC_APP_URL` y reinicia `pnpm dev`.

Requisitos: Supabase local (`pnpm supabase start`), `pnpm dev` y `ngrok http 3000` corriendo.

## Cuentas para probar

| Quién | Correo | Contraseña |
|---|---|---|
| Dueño plan Pro con tarjeta "Café Luna" | pagopro@correo.com | TestE2E123! |
| Dueños demo (free / basic / pro / premium) | owner-free@demo.co, owner-basic@demo.co, owner-pro@demo.co, owner-premium@demo.co | Demo1234! |
| Cliente | el que registres tú | código de 6 dígitos al correo |

## 1. Correos (Resend)

Mientras `fidelitap.co` no esté verificado en Resend, los correos salen de `onboarding@resend.dev` y **solo se entregan al correo dueño de la cuenta de Resend** (`fidelitap.desarrollo@gmail.com`). Por eso, para probar usa ese correo como cliente.

1. En tu celular abre `<URL pública>/c/prueba-de-tarjetas-fidelitap-41af` (tarjeta de Café Luna).
2. Regístrate con `fidelitap.desarrollo@gmail.com`. Debe llegar: **código de verificación** (de Supabase; en local queda en el buzón de pruebas, no en Gmail) y luego el **correo de bienvenida** (Resend).
3. Cuando completes la tarjeta (paso 4) llega el correo de **premio completado**.

Los códigos de verificación de Supabase local no salen a Gmail: se leen en el buzón local (`http://127.0.0.1:54324`). En producción salen por Resend/SMTP.

## 2. Tarjeta en Google Wallet

Google Wallet está en modo demo: **solo las cuentas añadidas como "usuarios de prueba"** en Google Pay & Wallet Console → Wallet API → tu emisor → Usuarios de prueba pueden guardar la tarjeta. Agrega tu cuenta de Google ahí.

1. Después de activar la tarjeta (paso 1) aparece el botón "Agregar a la Billetera de Google". Tócalo desde un celular Android con esa cuenta de Google.
2. Debe abrir Google Wallet con la tarjeta de Café Luna. En el panel de Google Wallet (Console) puedes ver el pase emitido.

## 3. Notificaciones push web

1. En la pantalla de éxito de la activación (celular, navegador Chrome) acepta "Recibir avisos de tu tarjeta". Solo aparece si el negocio es Pro/Premium (Café Luna lo es).
2. Como dueño (`pagopro@correo.com`) entra a **Campañas** → crea una campaña "Enviar ahora". Debe llegar la notificación al celular.
3. Aviso de "te falta 1 sello": se dispara al sellar cuando al cliente le falta el número configurado (por defecto 1).

## 4. Sellos y actualización de la tarjeta

1. Dueño → **Escanear** → "Ingresar código manualmente" con el código de la tarjeta del cliente (aparece en su pantalla como QR; también está en la base de datos).
2. Cada sello actualiza el pase de Google Wallet (puede tardar unos segundos) y dispara el push si aplica.
3. Al completar la tarjeta: correo de premio completado y estado "Premio listo" para reclamar; el dueño pulsa "Entregar premio".

## 5. App móvil (push FCM, geofencing, escáner con cámara)

Requiere un APK instalado en un celular Android (la compilación se hace en GitHub, ver `docs/app-movil-publicacion.md`). Hasta entonces la app solo se puede probar en el navegador, sin cámara ni push nativo.

## 6. Pagos (MercadoPago sandbox)

Dueño → Ajustes → Suscripción → elegir plan. Paga como el **comprador de prueba** de MercadoPago (no con tu cuenta real ni con el vendedor de prueba). Tarjetas de prueba: panel de MercadoPago → Tarjetas de prueba.
