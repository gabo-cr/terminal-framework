# terminal-framework

Nombre provisional de un proyecto open source para crear sitios web personales cuya interfaz principal sea una terminal interactiva. El visitante explora contenidos mediante comandos; el producto no es un portfolio tradicional ni una simulación completa de Bash.

La primera implementación será un sitio personal donde conviven la ingeniería, la literatura y las ideas. La aplicación debe ser reutilizable para otros sitios mediante configuración y contenidos externos.

## Arquitectura aprobada

- React + TypeScript + Vite para la aplicación.
- Tailwind CSS para los estilos, Zod para la validación y Vitest para las pruebas.
- SPA estática publicable en GitHub Pages.
- Core independiente de React y de la presentación.
- Configuración y contenidos externos, con URL raíz definida mediante `VITE_CONTENT_BASE_URL`.

La organización prevista comprende estos módulos:

| Módulo | Responsabilidad |
| --- | --- |
| `app` | Composición de la aplicación e inicialización. |
| `core` | Lógica de dominio y, en incrementos posteriores, interpretación y ejecución de comandos, sin dependencias de React. |
| `configuration` | Carga, validación y resolución de la configuración externa. |
| `content` | Acceso al catálogo y carga y caché de documentos Markdown. |
| `terminal` | Interfaz de terminal y presentación de las ejecuciones. |
| `shared` | Utilidades y tipos realmente compartidos. |
| `styles` | Estilos globales y convenciones visuales. |

Estas responsabilidades orientan la implementación; no requieren crear módulos vacíos ni abstracciones anticipadas.

## Contratos de configuración

Los archivos JSON se resuelven desde la raíz externa configurada. Sus esquemas exactos, nombres de campos y reglas de compatibilidad se definirán al implementar el primer incremento, respetando estos contratos:

### `site.json`

Incluye versión, nombre, descripción, idioma (`es` o `en`), mensaje de bienvenida configurable y colores básicos.

### `commands.json`

Define comandos personalizados de tipo `document` o `collection`, con nombres, descripciones, alias y referencias a los elementos correspondientes del catálogo.

### `content.json`

Define el catálogo de documentos Markdown y las colecciones. Cada colección requiere un documento introductorio. Los documentos se identifican mediante un ID global dentro del catálogo.

## Comportamiento del MVP

- Comandos integrados: `help`, `clear` y `history`.
- Sintaxis: `comando [argumento]`.
- Sin flags, búsqueda, paginación ni categorías.
- Las colecciones permiten mostrar su introducción, listar todos sus documentos y consultar documentos por ID global.
- La inicialización es estricta: cualquier fallo de carga o validación de un JSON, o cualquier referencia inválida, impide alcanzar el estado `ready`.
- Los documentos Markdown se descargan bajo demanda y se cachean durante la sesión. Su descarga no forma parte de la validación inicial de los JSON y sus referencias.

La sintaxis concreta para las operaciones de colección, las reglas de nombres y alias y las políticas de error de descarga de Markdown quedan pendientes de definición en sus incrementos correspondientes.

## Identidad visual inicial

- Fondo de página blanco.
- Nombre y descripción del sitio sobre la terminal.
- Panel de terminal gris oscuro y texto de comandos verde.
- Separadores entre ejecuciones.
- Markdown renderizado dentro de la terminal.

Los colores básicos serán configurables. Los valores exactos y su correspondencia con los elementos visuales se definirán al implementar el contrato de `site.json`.

## Primer incremento: alcance actual

El trabajo de implementación se limita a:

1. Preparar la infraestructura del proyecto con las tecnologías aprobadas.
2. Cargar remotamente `site.json`, `commands.json` y `content.json` desde `VITE_CONTENT_BASE_URL`.
3. Validar los tres contratos y sus referencias antes de declarar la aplicación `ready`.
4. Presentar de forma básica el nombre y la descripción del sitio, con estados de carga y error comprensibles.
5. Probar la carga, la validación y la condición estricta de inicialización.

No implementar todavía la terminal interactiva, el motor de comandos, la descarga y renderización de Markdown ni su caché. El comportamiento de terminal descrito arriba es contexto para incrementos posteriores, no trabajo autorizado en este incremento.

La tarea documental inicial únicamente crea la documentación de contexto: no crea la aplicación ni instala dependencias.

## Forma de trabajo

- Usar pnpm como gestor de paquetes, con versión fijada en `package.json` y `pnpm-lock.yaml` como único lockfile.
- Avanzar mediante incrementos pequeños, verificables y limitados al alcance acordado.
- Ejecutar las pruebas pertinentes en cada cambio de implementación y comunicar sus resultados; si no pueden ejecutarse, indicar el motivo.
- Mantener separadas la lógica de dominio, la configuración, el acceso a contenidos y la presentación.
- Evitar complejidad prematura, dependencias innecesarias y abstracciones sin un caso de uso actual.
- Actualizar esta documentación cuando cambien las decisiones aprobadas. No convertir cuestiones pendientes en requisitos implícitos.
