# App móvil: cómo publicarla

Estado del código: la app (dueño y cliente) está lista para compilar. Lo que falta son cuentas y datos de producción, que dependen de ti.

## 1. Compilar en la nube (sin Android Studio)

El workflow `.github/workflows/mobile-release.yml` compila el AAB (para Play Store) y un APK (para instalar directo) firmados.

1. Sube el repo a GitHub (ya está conectado por SSH).
2. En GitHub → Settings → Secrets and variables → Actions, crea estos secrets:

| Secret | Qué es |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | La llave de subida. Se copia con `sh scripts/android-secrets-helper.sh` y se pega (no se ve en pantalla). |
| `ANDROID_KEYSTORE_PASSWORD` | Contraseña del almacén (está en `mobile/android/key.properties`, que no se sube a git). |
| `ANDROID_KEY_PASSWORD` | Contraseña de la llave (mismo archivo). |
| `ANDROID_KEY_ALIAS` | `fidelitap-upload` |
| `API_BASE_URL` | `https://fidelitap.co` (la web ya publicada en Vercel). |
| `SUPABASE_URL` | URL del proyecto de Supabase Cloud. |
| `SUPABASE_ANON_KEY` | Anon key de Supabase Cloud (es pública, pero va como secret por orden). |

3. Actions → "Mobile release (Android)" → Run workflow. Al terminar, descarga `fidelitap-android` (AAB + APK).

Guarda bien la llave `~/fidelitap-secrets/fidelitap-upload.p12`: si la pierdes no podrás actualizar la app en Play Store.

## 2. Google Play (cuenta de desarrollador: USD 25 una vez)

- **Nombre:** Fidelitap
- **ID de la app:** `co.fidelitap.fidelitapMobile` (no se puede cambiar después de publicar).
- **Descripción corta (80 caracteres):** Junta sellos en tus negocios favoritos y reclama premios. Todo en tu celular.
- **Descripción larga:**
  Fidelitap reúne tus tarjetas de fidelidad en una sola app. Escanea el QR de un negocio, junta un sello en cada visita y reclama tu premio cuando completes la tarjeta. Guárdala también en Google Wallet.
  Descubre tiendas cercanas con tarjeta de sellos, filtra por categoría y únete en segundos. ¿Tienes un negocio? Entra como dueño para dar sellos con el escáner, ver tus clientes y enviar notificaciones.
- **Categoría:** Compras (o Estilo de vida).
- **Política de privacidad:** `https://fidelitap.co/privacy` (está en borrador: requiere revisión legal antes de publicar).
- **Clasificación de contenido:** apta para todo público.
- **Seguridad de los datos (qué declarar):** nombre, correo y teléfono (cuenta y tarjeta), ubicación aproximada y precisa (tiendas cercanas y avisos de proximidad), identificadores de dispositivo (notificaciones push). Los datos se cifran en tránsito y la persona puede pedir que se eliminen.
- **Permiso de ubicación en segundo plano** (`ACCESS_BACKGROUND_LOCATION`): Google exige un video y una justificación. Texto sugerido: "La ubicación en segundo plano se usa únicamente para avisar al cliente cuando pasa cerca de un negocio donde tiene una tarjeta con sellos pendientes. El cliente puede desactivarla por negocio en Perfil."
  Si quieres publicar más rápido, puedes quitar esa función de la primera versión (se retira el permiso del `AndroidManifest.xml`).
- **Capturas:** mínimo 2 de teléfono (1080×1920). Se pueden tomar de la app corriendo; sugeridas: Inicio del dueño, Tarjetas, Escáner, Tiendas cercanas, Mis tarjetas del cliente.
- **Ícono de la tienda:** `mobile/assets/brand/icon.png` (512×512 se genera de ahí).

## 3. App Store (Apple Developer: USD 99 al año)

- Hace falta un Mac con Xcode (en esta máquina no está instalado).
- Mismo bundle id: `co.fidelitap.fidelitapMobile`. Subir las llaves de notificaciones (APNs) a Firebase.
- Apple Wallet: las 6 variables `APPLE_*` siguen con valores de prueba; se llenan con los certificados de la cuenta de Apple Developer.
- Botón "Agregar a Apple Wallet": hay que bajar la insignia oficial de developer.apple.com (pide aceptar su licencia) y copiarla a `public/wallet/add-to-apple-wallet.svg` y `mobile/assets/wallet/add_to_apple_wallet.svg`. Mientras no esté, se muestra un botón provisional.

## 4. Antes de publicar

- [ ] Web publicada en Vercel con dominio `fidelitap.co` y Supabase Cloud con las migraciones aplicadas.
- [ ] MercadoPago: marcar "Planes y suscripciones" en el panel y poner la URL del webhook en fidelitap.co.
- [ ] Resend con el dominio verificado (correos de bienvenida y códigos).
- [ ] Revisión legal de `/privacy`, `/terms` y la política de cancelación.
- [ ] Probar en un celular real: escáner con cámara, código por correo, notificaciones, ubicación.
