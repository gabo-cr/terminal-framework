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
- El adaptador de arranque `src/app/loadConfiguration.ts` lee `VITE_CONTENT_BASE_URL` e `import.meta.env.DEV` y delega en `bootstrapConfiguration` (`src/app/bootstrap.ts`). Este bootstrap no depende de React ni Vite: recibe raíz, opción de desarrollo y `fetch` inyectable; carga los archivos, aplica esquemas y defaults, valida referencias y rutas, y solo entonces devuelve la configuración completa. React se monta inmediatamente y un hook de carga ejecuta el bootstrap. Los estados son `loading`, `ready` y `error`; solo se muestra el sitio al completar todas las validaciones. El reintento vuelve a ejecutar el bootstrap y los resultados de efectos descartados no actualizan el estado.
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

Las operaciones de colección usan `comando`, `comando list` y `comando <documento>`. La descarga pública de Markdown se describe en el Incremento 3; la caché de sesión también pertenece al Incremento 3 y el renderizado queda pendiente.

## Identidad visual inicial

- Fondo de página blanco.
- Nombre y descripción del sitio sobre la terminal.
- Panel de terminal gris oscuro y texto de comandos verde.
- Separadores entre ejecuciones.
- Markdown renderizado dentro de la terminal.

Los colores de `theme` se aplican al panel y a sus acentos. La primera interfaz es adaptable a móvil y escritorio y no acepta comandos. La presentación está separada del hook de carga y del bootstrap. El nombre y la descripción actualizan el título y la meta descripción HTML; `locale` actualiza el idioma del documento. Antes de recibir una configuración válida, los mensajes usan el idioma inicial del navegador (`en` o, como alternativa, `es`). La configuración ficticia en `public/example-content` permite probar el arranque por HTTP local con Vite.

## Primer incremento

El trabajo de implementación se limita a:

1. Preparar la infraestructura del proyecto con las tecnologías aprobadas.
2. Cargar remotamente `site.json`, `commands.json` y `content.json` desde `VITE_CONTENT_BASE_URL`.
3. Validar los tres contratos y sus referencias antes de declarar la aplicación `ready`.
4. Presentar de forma básica el nombre y la descripción del sitio, con estados de carga y error comprensibles.
5. Probar la carga, la validación y la condición estricta de inicialización.

No implementar todavía la terminal interactiva, el motor de comandos, la descarga y renderización de Markdown ni su caché. El comportamiento de terminal descrito arriba es contexto para incrementos posteriores, no trabajo autorizado en este incremento.

La tarea documental inicial únicamente crea la documentación de contexto: no crea la aplicación ni instala dependencias.

## Incremento 2: motor implementado

La revisión final y el contrato de integración se describen en [CORE.md](CORE.md).

El motor comienza con `parseCommand`, `CommandRegistry` y los comportamientos internos `help`, `clear` e `history` en `src/core`, sin dependencias de React ni HTTP. El parser no depende de configuración; el registro reutiliza únicamente sus tipos. Incluye CommandExecutor con un servicio de contenidos inyectable, pero no interfaz de entrada ni descargas HTTP de Markdown.

- Devuelve una unión discriminada por `status`: `valid` con `command` (`name` y `argument` opcional), `empty`, o `error` con código estable.
- Recorta espacios exteriores, admite separadores de espacio en blanco (incluidas tabulaciones) y conserva mayúsculas, minúsculas y caracteres de los tokens. No comprueba la existencia del comando ni impone el formato de nombres de la configuración.
- Rechaza más de un argumento con `TOO_MANY_ARGUMENTS`.
- Rechaza flags (tokens que empiezan con `-`), comillas, backticks, barras invertidas, pipes, redirecciones, `;`, `&` y saltos de línea internos con `UNSUPPORTED_SYNTAX`. Esta comprobación tiene prioridad sobre la cantidad de argumentos. No interpreta sintaxis de shell. Los saltos de línea exteriores se eliminan con el resto del espacio exterior.

`CommandRegistry` recibe el arreglo de comandos personalizados ya validados. Registra primero `help`, `clear` y `history`, en ese orden, y después los personalizados en el orden de entrada. `find(name)` resuelve nombres y alias exactamente, sin normalización, y devuelve `undefined` si no existen. Un alias devuelve la misma definición que el nombre original. `list()` devuelve una lista ordenada de definiciones únicas, sin entradas adicionales por alias. `kind` distingue `internal` y `custom`; los personalizados conservan sus tipos `document` o `collection` y referencias. Los internos se identifican por nombre; el comportamiento de ayuda proporciona sus descripciones localizadas.

Las reglas de colisión y los nombres reservados se centralizan en `core/commandNames.ts` y se reutilizan desde el registro, la validación cruzada y el esquema de nombres reservados. El constructor rechaza conflictos con `CommandRegistryError` (`code: COMMAND_CONFLICT`) y ubicaciones del uso actual y original; no revalida esquemas ni referencias. No ofrece registro incremental ni ejecución. Conserva copias congeladas de las definiciones y sus alias para que cambios externos no desincronicen la búsqueda y el listado.

Los comportamientos de `core/internalCommands.ts` son funciones sin acceso al DOM, red ni almacenamiento:

- `helpCommand({ registry, locale }, argument?)`: devuelve ayuda general ordenada o específica. Resuelve alias y muestra el nombre canónico, conserva las descripciones personalizadas y localiza los mensajes internos en `es` o `en`. El uso de `document` es solo su nombre; `collection` muestra nombre, `nombre list` y `nombre <documento>` (`<document>` en inglés). La ayuda de `help` usa `help [comando]` o `help [command]`. Un destino inexistente devuelve `COMMAND_NOT_FOUND` con mensaje localizado.
- `clearCommand()`: devuelve `{ type: 'clear' }`, una solicitud para limpiar exclusivamente la salida visual; no modifica el historial.
- `historyCommand(previousHistory, currentInput)`: recibe instrucciones anteriores en orden cronológico y, por separado, el texto original de la ejecución actual. Devuelve entradas `{ number, input }` numeradas desde uno, incluida la actual, sin normalizar ni deduplicar textos. El llamador conserva el historial y debe registrar la instrucción actual exactamente una vez. No se intenta inferir si ya estaba registrada por comparación de texto, porque dos ejecuciones consecutivas pueden ser idénticas.

`core/commandResults.ts` define la unión discriminada `CommandResult` (`help`, `clear`, `history`, `text`, `markdown`, `list`, `error`). `CommandExecutor.execute(input, { history })` devuelve una promesa de un arreglo de resultados, sin JSX. Las entradas vacías devuelven `[]`. El contexto contiene únicamente instrucciones anteriores; el llamador conserva y registra la actual exactamente una vez. El ejecutor no almacena historial.

El ejecutor reutiliza el parser, el registro y los comportamientos internos. Rechaza argumentos para `clear`, `history` y comandos `document`; `help` admite un destino. Las búsquedas conservan mayúsculas y minúsculas. Los errores incluyen códigos estables y mensajes en el idioma configurado: `TOO_MANY_ARGUMENTS`, `UNSUPPORTED_SYNTAX`, `COMMAND_NOT_FOUND`, `INVALID_ARGUMENTS`, `DOCUMENT_NOT_FOUND`, `COLLECTION_NOT_FOUND`, `DOCUMENT_NOT_IN_COLLECTION` y `CONTENT_ERROR`. Los fallos del servicio conservan `cause` para depuración y no devuelven resultados parciales.

`content/ContentService.ts` declara solo tres operaciones: `getDocument(id)` y `getCollection(id)` consultan sincrónicamente el catálogo validado, y `getMarkdown(documentId)` devuelve una promesa del cuerpo Markdown. No hay implementación HTTP en este incremento.

- `document` solicita el documento referenciado y devuelve su Markdown intacto.
- `collection` sin argumento devuelve su introducción y una sugerencia localizada para ejecutar el nombre canónico seguido de `list`, incluso cuando se invoca mediante alias.
- `collection list` devuelve ID, título y descripción de todos los documentos enumerados, en el orden configurado, sin recuperar sus cuerpos Markdown. No añade la introducción salvo que esté enumerada.
- Otro argumento debe coincidir exactamente con un ID enumerado o con la introducción. Un documento global ajeno se rechaza antes de consultar su cuerpo.

La interfaz React no se conecta aún al ejecutor. No hay flags, búsqueda, navegación, plugins, persistencia ni caché de Markdown en esta tarea.

## Incremento 3: sistema de contenidos

`ContentCatalog` en `src/content` recibe `ContentConfig` después de validar esquemas y referencias durante la inicialización. No repite esas validaciones, descarga Markdown ni accede a React o HTTP.

| Consulta | Resultado |
| --- | --- |
| `getDocument(id)` | Documento por ID global, o `undefined`. |
| `getCollection(id)` | Colección por ID, o `undefined`. |
| `getIntroduction(collectionId)` | Documento introductorio, o `undefined` si la colección no existe. |
| `listDocuments(collectionId)` | Documentos en el orden exacto de `documents`; `[]` para una colección vacía y `undefined` para una inexistente. |
| `isDocumentInCollection(documentId, collectionId)` | Pertenencia a los documentos enumerados o a la introducción, igual que en el motor; `false` para IDs inexistentes. |

El listado no añade la introducción automáticamente. Se permiten documentos compartidos entre colecciones, documentos globales sin colección y colecciones vacías con introducción obligatoria. Las búsquedas son exactas y los índices de documentos y colecciones son independientes.

Usa mapas por ID y conjuntos de pertenencia: documento, introducción y pertenencia se consultan en O(1); obtener una colección o listar sus documentos requiere O(n) para copiar el arreglo correspondiente. El constructor toma una copia del catálogo y las consultas devuelven copias, para impedir que cambios externos desincronicen los índices o alteren el orden. No expone operaciones de escritura.

`ContentService` conserva su contrato. El catálogo implementa su parte síncrona (`getDocument` y `getCollection`); un servicio futuro podrá componer estas consultas con `getMarkdown`. Esta tarea solo verifica esa composición con un cuerpo simulado en pruebas y no conecta un servicio real al arranque ni modifica el motor.

### MarkdownContentProvider

El proveedor recibe `{ baseUrl, catalog, fetch?, development? }`. `baseUrl` es la
raíz de contenidos, que se comprueba con `normalizeContentBaseUrl`; el catálogo
solo necesita exponer `getDocument`. `getMarkdown(documentId)` resuelve el ID global,
obtiene su `path` y utiliza `resolveSafeRelativeUrl` antes de acceder a la red. No
reimplementa reglas de seguridad ni revalida esquemas.

Las solicitudes usan GET explícito, `credentials: 'omit'` y `redirect: 'error'`.
HTTPS es obligatorio salvo HTTP local en desarrollo, como en la configuración.
Rechazar redirecciones evita salir de la raíz mediante una respuesta del servidor.
El hosting debe permitir acceso público y CORS cuando corresponda; no se requiere
GitHub Pages ni otro proveedor específico. No se envían tokens ni cabeceras de
autorización. El `fetch` inyectable permite probar sin servidor real.

`response.ok` se comprueba antes de leer `response.text()`. El texto devuelto no se
recorta, normaliza, interpreta ni convierte a HTML. Se admiten cuerpos vacíos,
Unicode y caracteres especiales. Cada llamada realiza una nueva solicitud; el
proveedor no guarda resultados ni promesas y no modifica la política de caché del
navegador. La caché de sesión será una responsabilidad separada.

`ContentError` expone códigos estables y contexto de depuración:

| Código | Situación |
| --- | --- |
| `DOCUMENT_NOT_FOUND` | ID ausente del catálogo; no se realiza HTTP. |
| `INVALID_BASE_URL` | Raíz rechazada por las reglas existentes. |
| `UNSAFE_PATH` | Ruta rechazada antes de descargar. |
| `HTTP_ERROR` | Respuesta HTTP no exitosa; conserva `status`, URL e ID. |
| `NETWORK_ERROR` | Rechazo de Fetch o fallo al leer el cuerpo; conserva `cause`, URL e ID. |

CORS y redirecciones bloqueadas se reciben como errores de red de Fetch. Los
errores de URL conservan la causa original. Estos errores son diagnósticos de la
capa de contenidos; el motor sigue produciendo sus mensajes localizados y puede
conservar el error del proveedor como causa de `CONTENT_ERROR`.

El proveedor implementa la parte `getMarkdown` de `ContentService`, complementaria
al catálogo. No se conecta todavía a React ni al arranque y no incorpora renderizado
Markdown, caché ni persistencia.

### ContentCache

`new ContentCache(provider)` envuelve un proveedor con `getMarkdown(documentId)`.
Se crea una instancia por sesión, asociada a un único proveedor de raíz y catálogo
fijos. Si cambia la raíz o el catálogo, se crea una nueva instancia. No hay caché
global compartida entre sitios ni dependencia del transporte HTTP.

`getMarkdown(id)` usa el ID como clave y devuelve la misma Promise tanto para
consultas concurrentes como posteriores a un éxito. La Promise resuelta conserva
el Markdown original, incluso si es una cadena vacía. Solo la primera consulta
invoca al proveedor. Los rechazos eliminan la entrada y conservan el error original,
permitiendo un reintento posterior. Un error síncrono del proveedor también se
convierte en rechazo y no queda cacheado.

`clear()` elimina todas las entradas sin cancelar las descargas ya iniciadas. Sus
consumidores originales pueden completarlas, pero una descarga antigua no vuelve
a insertar contenido ni elimina una solicitud nueva tras la limpieza. Esta es una
operación interna del servicio y no está vinculada al comando visual `clear`.

La composición mantiene `ContentService` compatible:

```ts
const catalog = new ContentCatalog(configuration.content)
const provider = new MarkdownContentProvider({ baseUrl, catalog })
const cache = new ContentCache(provider)
const contentService: ContentService = {
  getDocument: (id) => catalog.getDocument(id),
  getCollection: (id) => catalog.getCollection(id),
  getMarkdown: (id) => cache.getMarkdown(id),
}
```

En desarrollo HTTP local se pasa además `development: true` al proveedor, según
las reglas existentes. La caché no conoce comandos, React, rutas ni solicitudes
HTTP; no incorpora expiración, límites de tamaño ni almacenamiento persistente.
Esta tarea no conecta el servicio a la UI ni modifica el motor de comandos.

## Forma de trabajo

- Usar pnpm como gestor de paquetes, con versión fijada en `package.json` y `pnpm-lock.yaml` como único lockfile.
- Avanzar mediante incrementos pequeños, verificables y limitados al alcance acordado.
- Ejecutar las pruebas pertinentes en cada cambio de implementación y comunicar sus resultados; si no pueden ejecutarse, indicar el motivo.
- Mantener separadas la lógica de dominio, la configuración, el acceso a contenidos y la presentación.
- Evitar complejidad prematura, dependencias innecesarias y abstracciones sin un caso de uso actual.
- Actualizar esta documentación cuando cambien las decisiones aprobadas. No convertir cuestiones pendientes en requisitos implícitos.
