# FideliTap — Guía de Deploy a Producción

## 1. Firebase (Push Notifications en app móvil)

### 1.1 Crear proyecto Firebase
1. Ir a https://console.firebase.google.com → **Add project** → "FideliTap"
2. Deshabilitar Google Analytics (opcional)
3. En **Project Settings → Your apps**:
   - Click **Add app → Android** → Package name: `co.fidelitap.fidelitapMobile` → descargar `google-services.json` → mover a `mobile/android/app/google-services.json`
   - Click **Add app → iOS** → Bundle ID: `co.fidelitap.fidelitapMobile` → descargar `GoogleService-Info.plist` → mover a `mobile/ios/Runner/GoogleService-Info.plist`
4. En **Project Settings → Service accounts** → **Generate new private key** → guardar el JSON

### 1.2 Configurar APNs (iOS push)
1. En Apple Developer Portal (https://developer.apple.com):
   - **Certificates → Keys → Create key** → habilitar **Apple Push Notifications service (APNs)**
   - Descargar la key (.p8), guardar el Key ID
2. En Firebase Console → **Project Settings → Cloud Messaging → Apple app configuration**:
   - Upload APNs Authentication Key → seleccionar el .p8, ingresar Key ID y Team ID

### 1.3 Activar Firebase en la app Flutter
```bash
cd mobile
flutter pub add firebase_core firebase_messaging flutter_local_notifications
```

Luego en `mobile/lib/push/push_service.dart`, reemplazar el shim con la implementación real:
```dart
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
// ... (ver docs de FlutterFire para setup completo)
```

### 1.4 Guardar service account como secret de Supabase
```bash
# Producción
supabase secrets set FCM_SERVICE_ACCOUNT_JSON='<contenido del JSON de service account>'

# Desplegar las Edge Functions
supabase functions deploy geofence-checkin
supabase functions deploy send-owner-push
```

---

## 2. Supabase Producción

### 2.1 Crear proyecto en Supabase Cloud
1. https://app.supabase.com → **New project** → nombre: "FideliTap"
2. Guardar la contraseña DB y el Project URL

### 2.2 Aplicar migraciones
```bash
# Configurar con el remote project
supabase link --project-ref <tu-project-ref>

# Aplicar todas las migraciones al proyecto remote
supabase db push

# Habilitar anonymous sign-ins (para la app móvil de clientes)
# Ir a Supabase Dashboard → Authentication → Settings → Anonymous sign-ins → Enable
```

### 2.3 Configurar Auth
En Supabase Dashboard → Authentication:
- **Email confirmations**: deshabilitar para desarrollo / habilitar para producción
- **Site URL**: `https://fidelitap.co`
- **Redirect URLs**: `https://fidelitap.co/auth/callback`

---

## 3. Vercel (Frontend Next.js)

### 3.1 Crear proyecto en Vercel
```bash
npx vercel --prod
```
O conectar el repo desde https://vercel.com/new

### 3.2 Variables de entorno en Vercel
Ir a Vercel → Project → Settings → Environment Variables y agregar:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
NEXT_PUBLIC_APP_URL=https://fidelitap.co

# MercadoPago
MP_ACCESS_TOKEN=<tu-access-token-produccion>
MP_WEBHOOK_SECRET=<tu-webhook-secret>
NEXT_PUBLIC_MP_PUBLIC_KEY=<tu-public-key-produccion>

# Resend (emails)
RESEND_API_KEY=<tu-api-key>
RESEND_FROM=noreply@fidelitap.co

# Apple Wallet
APPLE_CERT_PATH=<base64-encoded-cert>
APPLE_KEY_PATH=<base64-encoded-key>
APPLE_WWDR_CERT_PATH=<base64-encoded-wwdr>
APPLE_PASS_TYPE_IDENTIFIER=pass.co.fidelitap
APPLE_TEAM_IDENTIFIER=<tu-team-id>

# Google Wallet
GOOGLE_APPLICATION_CREDENTIALS_JSON=<json-de-service-account>
GOOGLE_WALLET_ISSUER_ID=<tu-issuer-id>

# Upstash (rate limiting)
UPSTASH_REDIS_REST_URL=<url>
UPSTASH_REDIS_REST_TOKEN=<token>
```

### 3.3 Configurar webhook de MercadoPago
En el dashboard de MercadoPago → Webhooks:
- URL: `https://fidelitap.co/api/webhooks/mercadopago`
- Eventos: `preapproval`, `payment`

---

## 4. App Store (iOS)

### Prerequisitos
- Cuenta Apple Developer ($99 USD/año): https://developer.apple.com/programs/
- Xcode en Mac

### 4.1 Configurar bundle ID y signing
En Xcode → Runner → Signing & Capabilities:
- Team: seleccionar tu Apple Developer account
- Bundle Identifier: `co.fidelitap.fidelitapMobile`

### 4.2 Build de producción
```bash
cd mobile
flutter build ios --release
```
Luego en Xcode: Product → Archive → Distribute App → App Store Connect

### 4.3 App Store Connect
1. Crear la app en https://appstoreconnect.apple.com
2. Subir el build (vía Xcode o Transporter)
3. Llenar metadata: nombre, descripción, screenshots, política de privacidad
4. Enviar a revisión

---

## 5. Play Store (Android)

### Prerequisitos
- Instalar Android toolchain:
  ```bash
  # Descargar Android Studio desde https://developer.android.com/studio
  # Luego en Android Studio → SDK Manager → instalar Android SDK
  ```
- Cuenta Google Play Developer ($25 USD one-time)

### 5.1 Build de producción
```bash
cd mobile
flutter build appbundle --release
```
Output: `mobile/build/app/outputs/bundle/release/app-release.aab`

### 5.2 Google Play Console
1. https://play.google.com/console → Nueva aplicación
2. Subir el `.aab`
3. Llenar store listing, screenshots, política de privacidad
4. Enviar a revisión

---

## Checklist final antes del launch

- [ ] Supabase project creado y migraciones aplicadas
- [ ] Anonymous sign-ins habilitado en Supabase Dashboard
- [ ] Variables de entorno configuradas en Vercel
- [ ] Webhook de MercadoPago apuntando a producción
- [ ] Dominio fidelitap.co configurado en Vercel
- [ ] SSL activo (Vercel lo hace automático)
- [ ] Firebase proyecto creado con APNs configurado
- [ ] `google-services.json` y `GoogleService-Info.plist` en el repo (git-ignored en producción)
- [ ] FCM service account secret en Supabase
- [ ] Edge Functions deployadas (`geofence-checkin`, `send-owner-push`)
- [ ] App iOS subida a App Store Connect
- [ ] App Android subida a Play Store
- [ ] Probar flujo completo en producción: registro → tarjeta → cliente → sello → premio
