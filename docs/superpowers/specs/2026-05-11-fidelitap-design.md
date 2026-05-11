# FideliTap — Diseño del Sistema

**Fecha:** 2026-05-11
**Estado:** Aprobado

---

## 1. Visión General

FideliTap es una plataforma SaaS de tarjetas de fidelización digital para negocios pequeños y medianos. Los negocios crean tarjetas de sellos personalizadas; sus clientes las guardan en Apple Wallet o Google Wallet y acumulan sellos por cada visita hasta obtener un beneficio.

**Nombre de dominio objetivo:** fidelitap.co
**Lanzamiento inicial:** Colombia
**Idioma:** Español (es-CO)

---

## 2. Actores del Sistema

| Actor | Descripción |
|-------|-------------|
| **Business Owner** | Dueño/administrador del negocio que adquiere FideliTap |
| **Customer** | Cliente final del negocio que acumula sellos |
| **FideliTap Admin** | Administrador interno de la plataforma |

---

## 3. Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui |
| Backend | Next.js API Routes (server actions donde aplique) |
| Base de datos | Supabase (PostgreSQL) |
| Auth | Supabase Auth (JWT + refresh tokens rotativos) |
| Storage | Supabase Storage (logos, fondos de tarjeta) |
| Realtime | Supabase Realtime (actualización live de sellos en Wallet) |
| Apple Wallet | `passkit-generator` (genera archivos .pkpass firmados) |
| Google Wallet | Google Wallet API (passes JWT) |
| Pagos | Wompi (Colombia) |
| Email | Resend (transaccionales) |
| QR | `qrcode` npm package (generación server-side) |
| Deploy | Vercel (frontend + API) + Supabase Cloud |
| Validación | Zod (todos los inputs en API) |

---

## 4. Modelo de Datos (PostgreSQL + RLS)

### `businesses`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
owner_id        uuid REFERENCES auth.users NOT NULL
name            text NOT NULL
email           text UNIQUE NOT NULL
plan            text CHECK (plan IN ('free','basic','pro')) DEFAULT 'free'
subscription_status text DEFAULT 'active'
wompi_customer_id   text
created_at      timestamptz DEFAULT now()
```
*RLS: Solo el owner_id puede leer y modificar su propio registro.*

### `loyalty_cards`
```sql
id                  uuid PRIMARY KEY DEFAULT gen_random_uuid()
business_id         uuid REFERENCES businesses NOT NULL
name                text NOT NULL
stamps_required     int NOT NULL CHECK (stamps_required BETWEEN 2 AND 50)
benefit_description text NOT NULL
design_config       jsonb NOT NULL
-- design_config: { color, bg_type, bg_value, stamp_icon, font, bg_image_url }
is_active           bool DEFAULT true
created_at          timestamptz DEFAULT now()
```
*RLS: El negocio solo ve sus propias tarjetas.*

### `customers`
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
email       text UNIQUE NOT NULL
name        text NOT NULL
phone       text
created_at  timestamptz DEFAULT now()
```
*RLS: El customer solo ve su propio registro. El negocio ve los customers vinculados a sus tarjetas.*

### `customer_cards`
```sql
id                  uuid PRIMARY KEY DEFAULT gen_random_uuid()
customer_id         uuid REFERENCES customers NOT NULL
loyalty_card_id     uuid REFERENCES loyalty_cards NOT NULL
unique_code         text UNIQUE NOT NULL  -- HMAC-SHA256 firmado
current_stamps      int DEFAULT 0
is_complete         bool DEFAULT false
times_completed     int DEFAULT 0
wallet_pass_serial  text
wallet_auth_token   text
apple_pass_url      text
google_pass_url     text
created_at          timestamptz DEFAULT now()
UNIQUE (customer_id, loyalty_card_id)  -- una tarjeta por cliente por programa
```
*RLS: Customer ve sus propias tarjetas. Business owner ve las tarjetas de su loyalty_card.*

### `stamp_events`
```sql
id                  uuid PRIMARY KEY DEFAULT gen_random_uuid()
customer_card_id    uuid REFERENCES customer_cards NOT NULL
business_id         uuid REFERENCES businesses NOT NULL
stamped_by          uuid REFERENCES auth.users NOT NULL
scan_token          text NOT NULL        -- token de un solo uso
ip_address          inet
device_fingerprint  text
created_at          timestamptz DEFAULT now()
-- SIN UPDATE ni DELETE permitidos por RLS (inmutable)
```

### `subscription_plans`
```sql
id                uuid PRIMARY KEY DEFAULT gen_random_uuid()
name              text NOT NULL
price_cop         int NOT NULL
max_loyalty_cards int              -- NULL = ilimitado
max_customers     int              -- NULL = ilimitado
features          jsonb
```

**Planes iniciales:**

| Plan | Precio COP | Tarjetas | Clientes |
|------|-----------|----------|----------|
| Freemium | $0 | 1 | 20 |
| Basic | $49.900/mes | 3 | 500 |
| Pro | $119.900/mes | Ilimitado | Ilimitado |

---

## 5. Arquitectura de Seguridad (Defense in Depth)

### 5.1 Anti-fraude de Tarjetas
- `unique_code` generado como `HMAC-SHA256(uuid + business_secret)` — no es el UUID crudo
- El QR contiene un **scan_token** con TTL de 60 segundos, rotado en cada escaneo
- Idempotencia: un sello por `(customer_card_id, business_session)` por día configurable
- `stamp_events` es inmutable: RLS bloquea UPDATE y DELETE para todos los roles

### 5.2 Aislamiento de Datos (Multi-tenancy)
- Row Level Security habilitado en todas las tablas
- `business_id` presente en todos los registros relacionados
- Supabase Storage con bucket policies: un negocio no puede acceder a archivos de otro
- Roles separados en JWT: `business_owner`, `customer`, `admin`

### 5.3 API & Rate Limiting
- Rate limiting en endpoint de sello: **10 req/min por business_id** (Upstash Redis via Vercel Edge)
- Rate limiting en login: **5 intentos → bloqueo 15min**
- Todos los inputs validados con **Zod** antes de cualquier operación en DB
- Headers de seguridad vía Next.js config: `Content-Security-Policy`, `HSTS`, `X-Frame-Options`, `X-Content-Type-Options`
- CORS estricto: solo dominios autorizados en lista blanca

### 5.4 Autenticación
- JWT con expiración de **15 minutos** + refresh token rotativo (Supabase Auth)
- Sesiones en **httpOnly cookies** — nunca en localStorage
- 2FA opcional para business owners (TOTP via Supabase)
- OAuth Google como opción de login
- Passwords hasheados con bcrypt (manejado por Supabase Auth)
- Magic link para customers (sin contraseña, menor fricción)

### 5.5 Apple & Google Wallet
- Certificado de Apple Pass firmado con clave privada almacenada como secret en Vercel
- `wallet_auth_token` en `customer_cards`: token que Apple usa para autenticar push updates
- Google Wallet passes firmados con Service Account JWT

---

## 6. Flujos de Usuario

### 6.1 Flujo del Negocio (Business Owner)

```
Registro (email/Google) →
  Onboarding: nombre del negocio →
    Crear tarjeta (editor visual con preview live):
      · Nombre de la tarjeta
      · Color principal + tipo de fondo (sólido/gradiente/imagen)
      · Ícono de sello (emoji picker o upload)
      · Número de sellos requeridos (2–50)
      · Descripción del beneficio
    →
    Selector de plantilla de cartel:
      · Estilo: Minimal & Clean
      · Formatos: A4 / Historia / Post cuadrado / Pantalla mostrador
      · Íconos del cartel heredados del ícono de sello de la tarjeta
      · Sistema inyecta: QR único, nombre, beneficio, preview de sellos, marca de agua FIDELITAP
      · Descarga como PDF o PNG
    →
    Dashboard:
      · Métricas: clientes activos, sellos hoy, canjes totales, tasa de retención
      · Lista de clientes con estado de sellos
      · Acceso al escáner QR
    →
    Escanear sello:
      · Modo cámara QR (principal)
      · Fallback: ingresar código único manualmente
      · Confirmación visual inmediata con estado actualizado
```

### 6.2 Flujo del Cliente (Customer)

```
Escanea QR del cartel del negocio →
  Registro rápido: nombre + email (magic link, sin contraseña) →
    Agregar tarjeta a Wallet:
      · Botón "Agregar a Apple Wallet" (.pkpass)
      · Botón "Agregar a Google Wallet" (JWT pass)
    →
    Acumular sellos:
      · Por cada visita, el negocio escanea el QR de la tarjeta
      · El sello aparece al instante en la tarjeta via Wallet push update
    →
    Al completar la tarjeta:
      · La tarjeta muestra estado "COMPLETADA 🎁"
      · El negocio valida y entrega el beneficio
      · La tarjeta se reinicia automáticamente (times_completed + 1)
```

---

## 7. Pantallas Principales

### 7.1 Landing Page (fidelitap.co)
- **Nav:** Logo, links (Cómo funciona, Precios, Negocios), Iniciar sesión, Empezar gratis
- **Hero:** Headline "Haz que tus clientes siempre regresen", CTA doble
- **Features strip:** 4 íconos minimalistas (Diseño propio, Apple & Google Wallet, Escaneo QR, Anti-fraude)
- **Sección "¿Cómo funciona?":** 3 pasos con ícono, título, descripción completa visible, chips de contexto + iPhone mockup interactivo sincronizado
- **CTA final:** Empezar gratis
- **Totalmente responsive** (mobile-first)

### 7.2 Editor de Tarjeta
- Formulario en columna izquierda
- Preview de tarjeta en tiempo real (derecha), renderizado como aparecerá en Wallet
- Emoji picker para ícono de sello
- Color picker para color principal
- Selector de fondo (sólido/gradiente/imagen)
- Selector de número de sellos (stepper 2–50)
- Campo de beneficio con contador de caracteres

### 7.3 Selector de Plantilla de Cartel
- Grid de plantillas predefinidas (estilo Minimal & Clean)
- Selector de formato (A4, Historia, Post, Pantalla)
- Preview del cartel con datos del negocio ya inyectados
- Descarga PDF / PNG

### 7.4 Dashboard del Negocio
- Sidebar: Dashboard, Mis tarjetas, Clientes, Escanear, Plantilla, Ajustes
- Tarjetas de métricas: clientes activos, sellos hoy, canjes, tasa retención
- Tabla de clientes: nombre, tarjeta, progreso de sellos, estado
- Badge de plan con upgrade CTA

### 7.5 Panel de Escaneo
- Modo cámara con visor QR animado
- Input de código manual como fallback
- Confirmación visual con nombre del cliente y progreso actualizado
- Indicador "Wallet actualizada ✓"

### 7.6 Tarjeta en Apple/Google Wallet
- Header: logo/ícono + nombre del negocio + contador de sellos
- Sección de progreso: íconos de sello (completados/pendientes)
- Campo de premio
- QR con código único + código alfanumérico visible
- Marca de agua "FIDELITAP" en esquina inferior derecha
- Se actualiza en tiempo real al recibir un sello

---

## 8. Integraciones

### Apple Wallet
- Librería: `passkit-generator`
- Tipo de pass: `storeCard`
- Push updates: Apple APNs para actualizar sellos en tiempo real
- Certificado: Apple Pass Type Certificate almacenado como Vercel secret
- El `wallet_auth_token` en `customer_cards` autentica las actualizaciones

### Google Wallet
- API: Google Wallet API (LoyaltyObject)
- Autenticación: Service Account JWT
- Updates: PATCH al LoyaltyObject cuando se agrega un sello

### Wompi (Pagos Colombia)
- Suscripciones recurrentes para planes Basic y Pro
- Webhook de Wompi actualiza `subscription_status` en `businesses`
- Soporte: tarjetas débito/crédito, PSE, Nequi

### Resend (Email)
- Welcome email al registrarse
- Confirmación de sello (opcional, configurable por negocio)
- Notificación de tarjeta completada
- Facturación mensual

---

## 9. Plantilla de Cartel (Poster)

- **Estilo:** Minimal & Clean (aprobado)
- **El sistema inyecta automáticamente:**
  - QR único del negocio (para que los clientes activen su tarjeta)
  - Nombre del negocio
  - Descripción del beneficio
  - Preview de sellos con el ícono personalizado de la tarjeta
  - Marca de agua FIDELITAP
- **Formatos de descarga:** A4 (PDF), Historia Instagram (PNG 1080×1920), Post cuadrado (PNG 1080×1080), Pantalla mostrador (PNG 1920×1080)
- **Generación:** Server-side con `puppeteer` o `satori` + `@vercel/og`

---

## 10. Límites del MVP (Freemium → Basic → Pro → Premium)

| Feature | Freemium | Basic | Pro | Premium |
|---------|----------|-------|-----|---------|
| Tarjetas de fidelización | 1 | 3 | 10 | Ilimitado |
| Clientes máximos | 20 | 500 | 2,000 | Ilimitado |
| Plantillas de cartel | 1 formato (A4) | 4 formatos | 4 formatos | 4 formatos |
| Métricas avanzadas | ✗ | ✗ | ✓ | ✓ |
| Exportar reportes CSV | ✗ | ✗ | ✓ | ✓ (CSV + Excel) |
| 2FA | ✗ | ✗ | ✓ | ✓ |
| Notificaciones hitos al cliente | ✗ | ✗ | ✓ | ✓ |
| Multi-sede | ✗ | ✗ | ✗ | ✓ |
| White-label (sin marca FideliTap) | ✗ | ✗ | ✗ | ✓ |
| Importar clientes masivo (CSV) | ✗ | ✗ | ✗ | ✓ |
| Dominio propio de activación | ✗ | ✗ | ✗ | ✓ |
| Soporte | Comunidad | Email 48h | Prioritario 24h | Prioritario 12h |
| Precio/mes | $0 | $49,900 | $99,900 | $179,900 |

---

## 11. Consideraciones Técnicas Clave

- **Realtime de sellos:** Supabase Realtime escucha inserciones en `stamp_events` y dispara el push update a Apple APNs / Google Wallet API via Edge Function
- **Generación de QR:** Siempre server-side, nunca client-side. El QR del cartel es diferente al QR de la tarjeta del cliente
- **QR del cartel:** Apunta a `fidelitap.co/join/{loyalty_card_id}` — para que los clientes activen su tarjeta
- **QR de la tarjeta del cliente:** Contiene el `unique_code` + `scan_token` firmado — para que el negocio dé sellos
- **Responsividad:** Diseño mobile-first. El dashboard del negocio debe funcionar en tablet (en mostrador) y el escáner en móvil
- **Poster generation:** `satori` para SVG/PNG, `@vercel/og` para renders rápidos en Edge, Puppeteer solo si se requiere PDF complejo
- **Idempotencia en sellos:** Antes de insertar en `stamp_events`, verificar que no existe un evento para el mismo `customer_card_id` + `scan_token`

---

## 12. Fuera del Alcance del MVP

- App mobile nativa (iOS/Android)
- PWA de cliente (fase 2)
- Múltiples idiomas
- API REST pública para integraciones externas (v2 — cuando haya demanda real de clientes Premium)
- SLA contractual con compensación económica (v2 — cuando haya tracción y clientes enterprise)
- Notificaciones push propias (solo Wallet updates)
- Programa de referidos

---

## 13. Decisiones de Diseño

| Decisión | Elección | Razón |
|----------|----------|-------|
| Stack | Next.js + Supabase | Velocidad de desarrollo, Realtime nativo, RLS |
| Pagos | Wompi | Líder en Colombia, soporte PSE/Nequi |
| Wallet cliente | Apple + Google Wallet | Sin fricción, sin app extra |
| Auth cliente | Magic link (sin contraseña) | Menor fricción en registro |
| Personalización tarjeta | Nivel intermedio + preview live | Equilibrio entre poder y simplicidad |
| Plantilla cartel | Minimal & Clean, íconos heredados de la tarjeta | Coherencia visual automática |
| Marca | Clean & Profesional, verde #00C896, negro #0f172a | Moderno, no "IA look", confiable |
| Anti-fraude | HMAC + scan_token TTL 60s + audit log inmutable | Defense in depth desde el diseño |
