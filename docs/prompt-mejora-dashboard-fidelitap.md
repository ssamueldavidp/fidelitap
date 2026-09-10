# Prompt: Mejora Completa del Dashboard de Fidelitap

## Contexto del Proyecto

Fidelitap es una plataforma SaaS de fidelización digital que permite a negocios crear y gestionar tarjetas de lealtad almacenadas en Apple Wallet y Google Wallet. Los negocios administran puntos/sellos, recompensas, campañas segmentadas y datos de clientes desde un dashboard central.

---

## PROMPT PRINCIPAL

```
Eres un experto en desarrollo frontend y diseño de interfaces SaaS. Tu tarea es revisar y mejorar completamente el dashboard de Fidelitap, una plataforma de fidelización digital B2B.

## Contexto del producto

Fidelitap permite a negocios:
- Crear tarjetas de fidelización digitales (Apple Wallet / Google Wallet)
- Gestionar puntos y sellos de clientes
- Configurar recompensas automáticas
- Crear campañas segmentadas (clientes nuevos, inactivos, VIP, cumpleaños)
- Ver métricas de retención y recurrencia

El dashboard es usado principalmente por dueños de negocios pequeños y medianos que NO son técnicos.

---

## OBJETIVOS DE MEJORA

### 1. CORRECCIÓN DE ERRORES

Revisa y corrige los siguientes tipos de errores en todo el código del dashboard:

**Errores de lógica:**
- Validaciones faltantes en formularios (campos requeridos sin validación, emails mal formateados, números negativos)
- Estados de carga (loading) no manejados — siempre mostrar skeleton o spinner mientras se cargan datos
- Manejo de errores de API faltante — todo fetch/axios debe tener try/catch con mensaje amigable al usuario
- Edge cases sin manejar: listas vacías, datos null/undefined, respuestas inesperadas del servidor

**Errores de TypeScript / JavaScript:**
- Tipos incorrectos o uso de `any` — reemplazar con tipos específicos
- Variables no inicializadas antes de usar
- Promesas sin await o sin manejo de rechazo
- Memory leaks en useEffect (sin cleanup functions)

**Errores de React:**
- Keys faltantes o incorrectas en listas
- Dependencias incorrectas en useEffect/useCallback/useMemo
- Re-renders innecesarios — aplicar React.memo, useCallback donde sea apropiado
- Estado mutado directamente en lugar de crear nuevo objeto

---

### 2. MEJORA DEL DISEÑO UI/UX

Aplica las siguientes mejoras de diseño manteniendo consistencia visual en todo el dashboard:

**Sistema de diseño:**
- Define y aplica variables CSS/tokens para: colores primarios, secundarios, neutros, estados (success, error, warning, info), tipografía, espaciado, bordes y sombras
- Paleta sugerida: primario #4F46E5 (indigo), éxito #10B981, advertencia #F59E0B, error #EF4444, fondo #F9FAFB, superficie blanca #FFFFFF
- Fuente: Inter o similar sans-serif moderno, jerarquía clara (h1: 24px bold, h2: 20px semibold, body: 14px, caption: 12px)

**Layout del dashboard principal:**
- Sidebar fijo a la izquierda con íconos + labels, indicador visual de sección activa
- Header top con: nombre del negocio, plan actual, avatar/menú de usuario
- Área de contenido con padding consistente (24px)
- Responsive: sidebar colapsable en tablet, drawer en móvil

**Sección Home / Overview:**
- Cards de métricas clave en la parte superior: Total clientes activos, Tarjetas emitidas hoy, Recompensas canjeadas este mes, Tasa de retención (%)
- Cada card con: ícono, número principal grande, comparativa vs mes anterior con flecha y color (verde/rojo)
- Gráfica de actividad de los últimos 30 días (línea o barras)
- Lista de actividad reciente (últimos sellos/puntos otorgados, últimas recompensas canjeadas)

**Sección Clientes:**
- Tabla con: nombre, email, puntos actuales, fecha último registro, estado (activo/inactivo/VIP)
- Filtros: por estado, por rango de puntos, por fecha de última visita
- Búsqueda en tiempo real
- Paginación o infinite scroll
- Click en cliente → drawer lateral o modal con detalle: historial completo, puntos, recompensas canjeadas

**Sección Tarjetas / Programa de Fidelización:**
- Vista previa en tiempo real de la tarjeta (Apple Wallet style mockup)
- Formulario de configuración claro con secciones: Apariencia (colores, logo), Mecánica (puntos vs sellos, meta), Recompensa (tipo, descripción), Configuración QR
- Indicadores de progreso del setup si es primera vez

**Sección Campañas:**
- Cards para crear nueva campaña con íconos visuales por tipo (Cumpleaños 🎂, Inactivos 💤, VIP ⭐, Nuevos 🆕, Personalizada ✏️)
- Lista de campañas activas con estado, alcance estimado y resultados
- Editor de mensaje con preview del SMS/push/email

**Sección Analytics:**
- Gráficas con Recharts o Chart.js: retención mensual, frecuencia de visitas, conversión de recompensas
- Filtros de fecha (7d, 30d, 90d, personalizado)
- Exportar datos a CSV

---

### 3. COMPONENTES REUTILIZABLES A CREAR/MEJORAR

Crea o refactoriza los siguientes componentes para que sean completamente reutilizables:

```tsx
// Componentes base requeridos:
<MetricCard title valor cambio icono color tendencia />
<DataTable columnas datos paginacion filtros busqueda onRowClick />
<StatusBadge estado /> // activo | inactivo | VIP | pendiente
<EmptyState titulo descripcion accion icono />
<LoadingSkeleton tipo /> // card | tabla | lista | texto
<ErrorBoundary fallback />
<ConfirmModal titulo mensaje onConfirm onCancel />
<ToastNotification tipo mensaje duracion />
<PageHeader titulo descripcion acciones breadcrumb />
<FormField label tipo error required helpText />
```

---

### 4. MEJORAS DE RENDIMIENTO

- Implementar lazy loading para todas las rutas/páginas (React.lazy + Suspense)
- Paginación del lado del servidor para listas de más de 50 items
- Debounce de 300ms en búsquedas en tiempo real
- Cacheo de datos con React Query o SWR (staleTime mínimo 30s para datos poco volátiles)
- Optimizar imágenes y logos con compresión adecuada
- Virtualización de listas largas (react-window o similar) si hay más de 200 filas

---

### 5. ACCESIBILIDAD Y UX

- Todos los botones interactivos con aria-label descriptivo
- Navegación por teclado funcional en modales y dropdowns
- Contraste de colores mínimo WCAG AA (ratio 4.5:1)
- Mensajes de error claros y accionables (no solo "Error 500", sino "No pudimos guardar los cambios. Intenta de nuevo.")
- Estados vacíos con ilustración simple y call-to-action claro
- Feedback inmediato en acciones (botón muestra spinner mientras carga, toast al completar)

---

### 6. ESTRUCTURA DE CÓDIGO LIMPIA

- Separar lógica de negocio en custom hooks (`useClientes`, `useCampañas`, `useMetricas`)
- Constantes y enums en archivos separados (`/constants`, `/types`)
- Centralizar llamadas a API en un servicio (`/services/api.ts`)
- Eliminar código duplicado — DRY principle
- Comentarios JSDoc en funciones complejas
- Eliminar console.log en producción

---

## INSTRUCCIONES DE EJECUCIÓN

1. Primero haz un análisis del código actual e identifica todos los problemas existentes antes de hacer cambios
2. Empieza por los errores críticos que rompen funcionalidad
3. Luego aplica el sistema de diseño base (variables, tokens)
4. Refactoriza componentes uno por uno, empezando por los más usados
5. Finaliza con optimizaciones de rendimiento
6. En cada cambio, asegúrate de que el componente funciona correctamente antes de pasar al siguiente

Reporta los cambios realizados en grupos lógicos. Si encuentras algo que requiere decisión de diseño, propón 2 opciones con pros/contras.
```

---

## PROMPTS COMPLEMENTARIOS

### Para errores específicos de consola:
```
Analiza todos los errores y warnings en la consola del dashboard de Fidelitap. 
Para cada error: identifica la causa raíz, explica por qué ocurre y proporciona 
la solución específica con código. Prioriza por impacto (errores que rompen 
funcionalidad > warnings > deprecations).
```

### Para mejorar solo el diseño visual:
```
Rediseña los componentes del dashboard de Fidelitap siguiendo estas guías:
- Estilo: moderno, limpio, profesional (similar a Stripe Dashboard o Linear)
- Paleta: indigo/morado como color primario, fondos grises suaves
- Espaciado: generoso, sin elementos apilados
- Tipografía: jerarquía clara, nunca menos de 13px
- Sombras: sutiles (shadow-sm, shadow-md), no exageradas
- Bordes: rounded-lg como estándar, rounded-xl para cards principales
Mantén toda la funcionalidad existente, solo mejora la apariencia.
```

### Para el onboarding de nuevos negocios:
```
Crea un flujo de onboarding para nuevos negocios en Fidelitap con 4 pasos:
1. Información del negocio (nombre, logo, categoría)
2. Diseño de tarjeta (colores, nombre del programa, tipo puntos/sellos)
3. Configurar primera recompensa (meta, beneficio)
4. Compartir (QR code, link de registro)
Incluye barra de progreso, validación por paso, y opción de "completar después".
```

### Para el sistema de notificaciones:
```
Implementa un sistema de notificaciones en el dashboard de Fidelitap:
- Toast notifications para acciones rápidas (éxito, error, info)
- Centro de notificaciones en el header (campana con badge)
- Tipos: nuevo cliente registrado, recompensa canjeada, campaña enviada, límite de plan alcanzado
- Marcar como leída, limpiar todas, click lleva a la sección relevante
```

---

## CHECKLIST DE CALIDAD ANTES DE PUBLICAR

- [ ] No hay errores en la consola del navegador
- [ ] No hay warnings de React (keys, deps de hooks, etc.)
- [ ] Todos los formularios tienen validación
- [ ] Todos los estados de carga están manejados
- [ ] Todos los errores de API muestran mensaje amigable
- [ ] El diseño es consistente en todas las páginas
- [ ] Es responsive (móvil 375px, tablet 768px, desktop 1280px+)
- [ ] Los colores pasan contraste WCAG AA
- [ ] No hay texto hardcodeado que debería venir de variables
- [ ] No hay `console.log` en el código de producción
- [ ] TypeScript sin errores ni uso de `any`
- [ ] Todos los datos tienen estado vacío manejado

---

*Generado para el proyecto Fidelitap — Plataforma de Fidelización Digital*
