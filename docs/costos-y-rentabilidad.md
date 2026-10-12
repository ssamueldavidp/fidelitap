# Fidelitap: costos y rentabilidad

> Documento de análisis. Precios de proveedores verificados en sus páginas oficiales el 2026-10-11 (salvo lo marcado como estimado). Los montos en pesos usan un supuesto de **1 USD = $4.000 COP**: cámbialo con la TRM real. No incluye impuesto de renta, ICA ni retenciones, ni el valor de tu tiempo: pregunta a un contador.

## 1. Tabla de costos

### Costos fijos mensuales (para operar en producción)

| Servicio | Para qué | USD/mes | COP/mes | Estado del dato |
|---|---|---:|---:|---|
| Vercel Pro | Hosting web y API | 20.00 | $80.000 | Verificado |
| Supabase Pro | Base de datos, login, archivos (incluye $10 de cómputo) | 25.00 | $100.000 | Verificado |
| Dominio `.co` (anual ÷ 12) | fidelitap.co para web y correos | 2.50 | $10.000 | Estimado (USD 30/año) |
| Apple Developer (anual ÷ 12) | App iOS, Apple Wallet, push | 8.25 | $33.000 | Verificado (USD 99/año) |
| Resend | Correos transaccionales | 0.00 | $0 | Verificado: gratis hasta 3.000 correos/mes y 100/día |
| Upstash Redis | Límite de intentos (seguridad) | 0.00 | $0 | Verificado: gratis hasta 500.000 comandos/mes |
| Firebase (FCM) y Google Wallet | Push y tarjetas Android | 0.00 | $0 | Gratis según lo conocido, no verificado hoy |
| **Total fijo base** |  | **55.75** | **$223.000** |  |

Cuando pasas de ~30 negocios de pago, Resend gratis deja de alcanzar (supuesto: cada activación de cliente envía ~2 correos: código y bienvenida, y cada negocio activa ~50 clientes al mes). Entonces suma **Resend Pro USD 20/mes**: total fijo **$303.000/mes**.

### Costos únicos

| Concepto | Costo |
|---|---|
| Cuenta Google Play (pago único) | USD 25 ≈ $100.000 |
| Revisión legal de Privacidad y Términos (Ley 1581) | A cotizar con un abogado |
| Logo, capturas y ficha de las tiendas | A cotizar (o hecho por ti) |

### Costo variable: comisión de MercadoPago (Colombia)

**3,29% + $800 por cobro**, antes de impuestos. Cada negocio paga un cobro al mes.

| Plan | Precio | Comisión MP | Te queda (antes de impuestos) |
|---|---:|---:|---:|
| Basic | $49.900 | $2.442 (4,9%) | $47.458 |
| Pro | $99.900 | $4.087 (4,1%) | $95.813 |
| Premium | $179.900 | $6.719 (3,7%) | $173.181 |

## 2. Supuestos del modelo

- Todos los negocios de pago renuevan cada mes (sin churn). Ver riesgo en la sección 5.
- Los negocios en plan Free no generan ingreso y su costo es casi cero (la infraestructura es de costo fijo).
- **Escenario A (optimista):** los precios de los planes no llevan IVA y la comisión de MercadoPago tampoco.
- **Escenario B (conservador):** el precio publicado ya incluye IVA del 19% (el ingreso neto es precio ÷ 1,19) y la comisión de MercadoPago lleva IVA. Cuál aplica depende de tu régimen tributario: confírmalo con un contador.
- No se incluye inversión en marketing para conseguir negocios ni costo de soporte.

### Mezcla de planes: Base (50% Basic / 35% Pro / 15% Premium)

Ingreso bruto promedio por negocio: **$86.900/mes**. Aporte neto por negocio: **$83.241** (A) y **$68.671** (B).

| Negocios de pago | Ingreso bruto | Costos fijos | Ganancia mensual A | Ganancia mensual B |
|---:|---:|---:|---:|---:|
| 2 | $173.800 | $223.000 | -$56.518 | -$85.658 |
| 3 | $260.700 | $223.000 | $26.723 | -$16.987 |
| 5 | $434.500 | $223.000 | $193.205 | $120.355 |
| 10 | $869.000 | $223.000 | $609.410 | $463.710 |
| 20 | $1.738.000 | $223.000 | $1.441.820 | $1.150.420 |
| 30 | $2.607.000 | $303.000 | $2.194.230 | $1.757.130 |
| 50 | $4.345.000 | $303.000 | $3.859.050 | $3.130.549 |
| 100 | $8.690.000 | $303.000 | $8.021.099 | $6.564.099 |
| 200 | $17.380.000 | $303.000 | $16.345.198 | $13.431.198 |
| 500 | $43.450.000 | $303.000 | $41.317.495 | $34.032.494 |

**Negocios de pago necesarios para llegar a una ganancia mensual meta:**

| Meta de ganancia/mes | Escenario A | Escenario B |
|---:|---:|---:|
| Punto de equilibrio ($0) | 3 negocios | 4 negocios |
| $1.000.000 | 15 negocios | 18 negocios |
| $2.000.000 | 27 negocios | 34 negocios |
| $3.000.000 | 40 negocios | 49 negocios |
| $5.000.000 | 64 negocios | 78 negocios |
| $10.000.000 | 124 negocios | 151 negocios |

### Mezcla de planes: Pesimista (80% Basic / 15% Pro / 5% Premium)

Ingreso bruto promedio por negocio: **$63.900/mes**. Aporte neto por negocio: **$60.998** (A) y **$50.244** (B).

| Negocios de pago | Ingreso bruto | Costos fijos | Ganancia mensual A | Ganancia mensual B |
|---:|---:|---:|---:|---:|
| 2 | $127.800 | $223.000 | -$101.005 | -$122.513 |
| 3 | $191.700 | $223.000 | -$40.007 | -$72.269 |
| 5 | $319.500 | $223.000 | $81.988 | $28.219 |
| 10 | $639.000 | $223.000 | $386.977 | $279.437 |
| 20 | $1.278.000 | $223.000 | $996.954 | $781.875 |
| 30 | $1.917.000 | $303.000 | $1.526.931 | $1.204.312 |
| 50 | $3.195.000 | $303.000 | $2.746.884 | $2.209.187 |
| 100 | $6.390.000 | $303.000 | $5.796.769 | $4.721.373 |
| 200 | $12.780.000 | $303.000 | $11.896.538 | $9.745.746 |
| 500 | $31.950.000 | $303.000 | $30.195.845 | $24.818.865 |

**Negocios de pago necesarios para llegar a una ganancia mensual meta:**

| Meta de ganancia/mes | Escenario A | Escenario B |
|---:|---:|---:|
| Punto de equilibrio ($0) | 4 negocios | 5 negocios |
| $1.000.000 | 21 negocios | 25 negocios |
| $2.000.000 | 38 negocios | 46 negocios |
| $3.000.000 | 55 negocios | 66 negocios |
| $5.000.000 | 87 negocios | 106 negocios |
| $10.000.000 | 169 negocios | 206 negocios |

## 3. ¿Es rentable?

**Sí, el modelo es rentable con muy pocos clientes**, porque los costos fijos son bajos ($223.000/mes) y casi todo el costo de crecer es la comisión de MercadoPago (~4%).

- **Punto de equilibrio:** 3 negocios de pago (escenario A) o 4 (escenario B) con la mezcla base; 4 y 5 con la mezcla pesimista.
- **Ganancia de $2.000.000/mes:** 27 a 34 negocios de pago con la mezcla base (38 a 46 con la pesimista).
- **Ganancia de $5.000.000/mes:** 64 a 78 negocios de pago con la mezcla base.
- Cada negocio nuevo aporta entre $68.671 y $83.241 al mes, así que el margen mejora al crecer porque el costo fijo se reparte.

## 4. Cuándo suben los costos fijos

| Límite | Se alcanza aproximadamente con | Qué hacer |
|---|---|---|
| Resend gratis (3.000 correos/mes, 100/día) | ~30 negocios activos | Resend Pro, USD 20/mes |
| Upstash gratis (500.000 comandos/mes) | Cientos de negocios | Pasar a pago por uso ($0,20 por 100.000 comandos) |
| Supabase Pro (100.000 usuarios activos, 8 GB) | Más de ~2.000 negocios | Pagar excedentes o subir de cómputo |
| Vercel Pro ($20 de crédito incluido) | Mucho tráfico | Revisar consumo |

## 5. Riesgos que pueden romper el cálculo

1. **Churn por falta de pago.** El cobro ya es una suscripción automática mensual (MercadoPago PreApproval): se renueva solo hasta que el negocio cancele, así que no depende de que se acuerde de pagar. Quedan dos fuentes de pérdida: cancelaciones voluntarias y tarjetas que fallan (3 días de gracia antes de bajar a Free). Conviene medir ambas.
2. **Costo de adquirir clientes.** El modelo no incluye marketing, comisiones de ventas ni tu tiempo de soporte. Si cada negocio nuevo te cuesta, por ejemplo, $100.000 conseguirlo, tarda más de un mes en pagarse.
3. **Impuestos.** Renta, IVA, ICA y retenciones pueden reducir la ganancia real de forma importante.
4. **TRM.** Los servicios se pagan en dólares; si el dólar sube, los costos fijos suben en pesos.
5. **Mezcla de planes.** Si la mayoría elige Basic, el aporte por negocio baja ~27% (ver mezcla pesimista).
6. **Dependencia de la comisión.** Si MercadoPago cambia sus tarifas, cambia el margen.

## 6. Para validar cuanto antes

- Confirmar con un contador el tratamiento del IVA y el régimen (esto decide entre escenario A y B).
- Medir cuántos correos reales envía cada activación de cliente para afinar el umbral de Resend.
- Tener una meta realista de conversión: de cada 100 negocios que prueban el plan Free, ¿cuántos pasan a pago?
