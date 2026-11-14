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

Los archivos JSON se resolverán desde la raíz externa configurada. Los contratos estructurales están implementados con Zod en `src/configuration`, con tipos TypeScript derivados de los esquemas. Todos los objetos son estrictos: rechazan propiedades desconocidas. Los tres archivos requieren `version: 1` numérico; otras versiones se rechazan.

### `site.json`

- `name` y `description`: cadenas obligatorias con texto no vacío.
- `locale`: `es` o `en`; predeterminado `es`.
- `terminal.welcome`: cadena opcional. Si se omite, se genera «Bienvenido. Escribe help para explorar el sitio.» o «Welcome. Type help to explore the site.» según el idioma.
- `theme.accentColor`: hexadecimal de seis dígitos con `#`; predeterminado `#96D9A5`.
- `theme.terminalBackground`: mismo formato; predeterminado `#292C32`.

`terminal` y `theme` son opcionales y sus valores se completan por propiedad, incluso cuando se proporciona un objeto vacío o parcial. Una bienvenida explícita vacía se conserva. Los tipos `SiteConfigInput` y `SiteConfig` distinguen la entrada de la configuración con valores predeterminados aplicados.

### `commands.json`

Requiere el arreglo `commands`, que puede estar vacío. Cada comando tiene `type`, `name`, `description` y `aliases` opcional como arreglo. Los nombres y alias son cadenas no vacías compuestas de letras ASCII minúsculas, números y guiones; `help`, `clear` y `history` están reservados tanto en nombres como en alias.

- `type: "document"`: requiere `content` y prohíbe `collection`.
- `type: "collection"`: requiere `collection` y prohíbe `content`.

`description` debe contener texto no vacío. Las referencias usan el formato de ID del catálogo. La validación cruzada comprueba la existencia de sus destinos y rechaza colisiones entre nombres y alias, incluso alias repetidos dentro del mismo comando o iguales a su propio nombre.

### `content.json`

Requiere los arreglos `collections` y `documents`, que pueden estar vacíos.

- Colección: `id`, `title`, `description` opcional, `intro` obligatorio y `documents` como arreglo ordenado de IDs sin repeticiones.
- Documento: `id`, `title`, `description` opcional, `path` y `format: "markdown"`.

Los títulos y las rutas requieren texto no vacío. Los IDs usan segmentos alfanuméricos ASCII en minúsculas separados por un solo guion (`intro`, `essay-2`, `2026-notes`); no admiten guiones iniciales, finales ni consecutivos. Son únicos dentro de su tipo; una colección y un documento pueden compartir ID. Las cadenas con texto obligatorio rechazan espacios en blanco como único contenido, pero no se recortan ni normalizan.

Los esquemas validan la estructura; después, la validación cruzada comprueba la existencia de los IDs referenciados por `intro`, `documents` y los comandos. Las referencias se comprueban por tipo: un ID de colección no sirve como referencia a un documento y viceversa. La introducción puede aparecer también en la lista de documentos, pero esa lista no permite repeticiones.

`list` se reserva dentro de todas las colecciones: no puede ser el ID de su introducción ni de un documento enumerado. Puede existir un documento global `list` si ninguna colección lo expone. No se restringe `list` como nombre de comando global.

Todas las rutas de documento, incluidas las de documentos no referenciados, deben pasar `resolveSafeRelativeUrl` dentro de la raíz configurada. No se impone una extensión ni se comprueba la existencia del archivo Markdown durante el arranque.

### Carga remota

- `ConfigurationLoader` es independiente de React y Vite; recibe la raíz, la opción de desarrollo y un `fetch` inyectable.
- El adaptador de arranque `src/app/loadConfiguration.ts` lee `VITE_CONTENT_BASE_URL` e `import.meta.env.DEV` y delega en `bootstrapConfiguration` (`src/app/bootstrap.ts`). Este bootstrap no depende de React ni Vite: recibe raíz, opción de desarrollo y `fetch` inyectable; carga los archivos, aplica esquemas y defaults, valida referencias y rutas, y solo entonces devuelve la configuración completa. El arranque monta la página temporal únicamente si todo termina correctamente; ante errores registra el diagnóstico en consola. La UI de carga y errores queda pendiente.
- La raíz es una URL absoluta HTTPS, normalizada con barra final. Se permite HTTP solo con desarrollo habilitado y host local (`localhost`, `127.0.0.1` o `[::1]`). Se rechazan credenciales, parámetros, fragmentos y segmentos ambiguos.
- Se solicitan en paralelo `config/site.json`, `config/commands.json` y `config/content.json`, se comprueba HTTP, se parsea JSON y se aplican los esquemas existentes. Cualquier fallo rechaza el resultado completo; no se devuelve configuración parcial ni se declara `ready`.
- `ConfigurationError.kind` distingue `invalid-base-url`, `unsafe-path`, `network`, `http`, `invalid-json`, `validation` y `cross-validation`. Los códigos estables en `code` son `INVALID_BASE_URL`, `UNSAFE_PATH`, `NETWORK_ERROR`, `HTTP_ERROR`, `INVALID_JSON`, `SCHEMA_VALIDATION_ERROR` y `CROSS_VALIDATION_ERROR`. Conserva URL, estado HTTP cuando procede y causa original (incluidos los errores de Zod con sus rutas). Un fallo de lectura del cuerpo se considera de red.
- Los errores cruzados se acumulan en `details` con código, archivo, ruta del campo, valor y, en colisiones, ruta del primer uso. Los códigos son `COMMAND_CONFLICT`, `DOCUMENT_NOT_FOUND`, `COLLECTION_NOT_FOUND`, `INTRO_NOT_FOUND`, `COLLECTION_DOCUMENT_NOT_FOUND`, `DUPLICATE_COLLECTION_DOCUMENT`, `RESERVED_COLLECTION_DOCUMENT` y `UNSAFE_DOCUMENT_PATH`. Las repeticiones estructurales detectadas antes por Zod mantienen `SCHEMA_VALIDATION_ERROR`.
- `resolveSafeRelativeUrl` permite rutas relativas dentro de la raíz. Rechaza rutas absolutas, segmentos `.` y `..`, barras invertidas, segmentos vacíos, parámetros, fragmentos, controles y sus variantes codificadas. Rechaza porcentajes residuales tras decodificar para impedir ambigüedad por doble codificación.
- Las solicitudes omiten credenciales y rechazan redirecciones para mantener el límite de la raíz. El servidor externo debe habilitar CORS cuando corresponda. Los rechazos de CORS o de redirección se reciben como errores de red de Fetch.
- No hay reintentos, caché de configuración ni descarga de Markdown en este incremento. El cargador sigue encargado únicamente de transporte y esquemas; la validación cruzada y la condición de éxito completo corresponden al bootstrap.

## Comportamiento del MVP

- Comandos integrados: `help`, `clear` y `history`.
- Sintaxis: `comando [argumento]`.
- Sin flags, búsqueda, paginación ni categorías.
- Las colecciones permiten mostrar su introducción, listar todos sus documentos y consultar documentos por ID global.
- La inicialización es estricta: cualquier fallo de carga o validación de un JSON, o cualquier referencia inválida, impide alcanzar el estado `ready`.
- Los documentos Markdown se descargan bajo demanda y se cachean durante la sesión. Su descarga no forma parte de la validación inicial de los JSON y sus referencias.

La sintaxis concreta para las operaciones de colección y las políticas de error de descarga de Markdown quedan pendientes de definición en sus incrementos correspondientes.

## Identidad visual inicial

- Fondo de página blanco.
- Nombre y descripción del sitio sobre la terminal.
- Panel de terminal gris oscuro y texto de comandos verde.
- Separadores entre ejecuciones.
- Markdown renderizado dentro de la terminal.

Los colores básicos son configurables mediante `theme`. Su aplicación a la interfaz queda para un incremento posterior.

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
