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

Los colores de `theme` se aplican al panel y a sus acentos. La primera interfaz es adaptable a móvil y escritorio y no acepta comandos. La presentación está separada del hook de carga y del bootstrap. El nombre y la descripción actualizan el título y la meta descripción HTML; `locale` actualiza el idioma del documento. Antes de recibir una configuración válida, los mensajes usan el idioma inicial del navegador (`en` o, como alternativa, `es`). Las fixtures de UI están en `tests/fixtures/ui-site`; el sitio HTTP de prueba está en `tests/fixtures/external-site` y se sirve con `pnpm run fixtures:serve`.

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

La verificación final, las fixtures externas y los comandos de reproducción se
describen en [INCREMENT-3.md](INCREMENT-3.md).

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

`ContentService` conserva su contrato. El catálogo implementa su parte síncrona (`getDocument` y `getCollection`); createContentService compone estas consultas con el proveedor HTTP y ContentCache sin modificar el motor.

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
al catálogo. Se compone mediante createContentService y el arranque integrado bootstrapApplication. No incorpora renderizado Markdown, caché propia ni persistencia.

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
El servicio se conecta al ejecutor en la capa app mediante inyección; la UI de terminal queda pendiente.

### Integración con el motor

`createContentService(configuration.content, options)` crea un catálogo, un proveedor
HTTP y una caché, y devuelve `CachedContentService`. Mantiene las tres operaciones
de `ContentService` y añade `clearCache()` únicamente como operación interna. No
se recrea ninguno de esos componentes dentro de una consulta o ejecución.

`createCommandRuntime(configuration, options)` recibe la configuración validada y
la raíz de contenidos, crea el servicio y un registro, e inyecta ambos junto con
`site.locale` en un único `CommandExecutor`. Devuelve `{ content, executor }` para
reutilizarlos durante la sesión. `bootstrapApplication(options)` combina la carga
y validación estricta con esa composición, devolviendo
`{ configuration, content, executor }`. El arranque no descarga Markdown.

El bootstrap de configuración existente conserva su contrato; la terminal utiliza
el arranque integrado mediante loadApplication. Los consumidores del
motor ya pueden usar el arranque integrado sin depender de React o Vite. No hay
singleton global: cada nuevo arranque tiene su propia instancia y caché.

Los fallos HTTP y de red llegan al ejecutor como `ContentError`, se convierten en
el resultado recuperable `CONTENT_ERROR` con mensaje localizado y conservan el
diagnóstico en `cause`. El rechazo se elimina de la caché para permitir reejecutar
el comando. Un archivo inexistente en el servidor produce HTTP 404 recuperable;
las referencias inexistentes en el catálogo se rechazan durante el bootstrap.
La consulta directa del servicio a un ID ausente sigue rechazando con
`DOCUMENT_NOT_FOUND` antes de acceder a la red.

Se mantienen los comportamientos y resultados del Incremento 2, incluidas la
introducción como documento accesible, la sugerencia canónica, los listados sin
cargar Markdown y `clear` sin vaciar la caché ni el historial. Las pruebas nuevas
de `tests/app/contents.integration.test.ts` usan los componentes reales con `fetch`
simulado en ambos idiomas y conservan todas las pruebas anteriores.

## Incremento 4: terminal e interacción básica

La aplicación ya utiliza la terminal interactiva con configuración y contenidos
remotos. Las restricciones de UI de los incrementos anteriores describen su alcance
histórico. La integración y la comprobación en navegador están documentadas en
[INCREMENT-4.md](INCREMENT-4.md).

`src/terminal` contiene los componentes visuales y `useTerminal`. La página se
inicializa mediante `loadApplication` y conserva el servicio y ejecutor creados
por el bootstrap. `useConfiguration` admite el resultado tipado del arranque
completo y conserva sus estados de carga, error y reintento.

Cada intento comparte una única promesa de bootstrap entre las activaciones del
efecto de StrictMode. No hay caché global de inicialización: un reintento, un cambio
de cargador o un nuevo montaje inicia una sesión distinta. La sesión anterior se
retira inmediatamente al cambiar el cargador, incluso al volver a uno usado antes.
Las resoluciones y los rechazos obsoletos no actualizan el estado; los comandos
pendientes de una terminal desmontada tampoco se muestran en la nueva sesión.

El prompt es una entrada controlada. Enter acepta una instrucción no vacía,
conserva su texto original y vacía el campo. No se envía Enter durante composición
IME ni eventos repetidos. El hook ignora espacios vacíos sin interpretar sintaxis;
el parser y el registro siguen siendo responsabilidad exclusiva del ejecutor.

`useTerminal` posee dos historiales: `commandHistory` incluye todas las
instrucciones aceptadas (también fallidas y clear); `entries` conserva la salida
visual con ID, comando original, resultados del Core y estado `pending`, `success`
o `error`. El ejecutor recibe una copia del historial anterior antes de registrar
la instrucción actual, de modo que history la incluye exactamente una vez.

Una referencia bloquea sincrónicamente los envíos mientras hay una ejecución
pendiente. El prompt queda de solo lectura y la entrada pendiente muestra un
indicador localizado. Los resultados de error no rompen la sesión; un rechazo
inesperado se muestra como error recuperable con causa de depuración sin exponerla
en pantalla. Los resultados tardíos tras desmontar la sesión no actualizan React.

El resultado `{ type: 'clear' }` vacía únicamente `entries`: no deja una ejecución
de clear visible ni borra comandos, bienvenida o caché. El hook no conoce HTTP,
no modifica el comportamiento del Core y no conserva otro historial en el motor.

`TerminalOutput` presenta los tipos existentes: texto literal, Markdown renderizado,
ayuda, listados con ID/título/descripción, historial y errores diferenciados mediante
`role="alert"`. La causa de depuración no se muestra al visitante. Clear se aplica
en el controlador y no produce contenido visible.
Los colores, bienvenida, metadatos y estados de inicialización siguen configurados
por el sitio. No hay muestras de contenido personal en producción.

### Navegación, foco y desplazamiento

El componente de entrada existente es `TerminalPrompt`. Flecha arriba y abajo
llaman a `useTerminal.navigateHistory` para recorrer instrucciones aceptadas sin
mutarlas ni ejecutarlas. Se conserva el texto original, incluidos alias y espacios.
Al iniciar la navegación se guarda el borrador; al volver al final se restaura.
Editar una instrucción recuperada modifica solo la copia de entrada y no reemplaza
el borrador guardado. Enviar una instrucción reinicia el cursor de navegación.
Sin historial las flechas son inocuas; durante una ejecución no se navega.

La entrada sigue en el orden natural del teclado, conserva su etiqueta accesible
y, por decisión visual, no muestra contorno al enfocar el input; conserva el cursor
y su etiqueta accesible. Recibe foco al montar y lo recupera al perderlo mediante
`focus({ preventScroll: true })`, por decisión de interacción aprobada para mantener
el cursor nativo activo en el prompt. Durante la espera permanece montada y de
solo lectura. Esta política devuelve también el foco cuando se intenta enfocar
otro elemento de la página.
La composición IME, los eventos Enter repetidos y el bloqueo síncrono existente
previenen envíos accidentales; las flechas con modificadores no se interceptan.

La página ocupa la altura dinámica de la ventana (`100dvh`). La cabecera es
compacta y la terminal ocupa el espacio restante; el input permanece al pie.
El texto de terminal usa 13 px e interlineado de 20 px, con márgenes Markdown
reducidos. El input móvil mantiene 16 px para evitar zoom al enfocarlo.
La bienvenida y el historial están dentro de un viewport flexible de altura limitada,
con desplazamiento propio, foco visible, etiqueta de región y navegación de
teclado; el prompt queda fuera de esa zona desplazable. `useTerminalScroll`
sigue las actualizaciones cuando el visitante estaba a 64 px o menos del final.
Si lee contenido anterior, conserva su posición. Un documento largo se muestra
desde el inicio de la ejecución reciente, no saltando al final de su texto.
Los cambios de tamaño conservan el anclaje de lectura del navegador y no vuelven
a ejecutar el seguimiento del último resultado; clear vuelve al comienzo del panel.
No se usa scrollIntoView ni desplazamiento global de la página.

El desplazamiento usa movimiento suave salvo que `prefers-reduced-motion: reduce`
esté activo (o no pueda consultarse), en cuyo caso es inmediato. El historial no
es una región live: el indicador `role="status"` anuncia solo la espera, el input
expone `aria-busy`, y los errores anuncian únicamente su mensaje mediante alert.
Los documentos no se anuncian completos en cada actualización.

Las pruebas en `tests/terminal/accessibility.test.tsx` verifican foco, no interferencia
con enlaces, estados accesibles y decisiones de scroll con geometría simulada.
Las pruebas de useTerminal cubren límites de historial, borrador y navegación real
con teclado. La revisión final también verifica en navegador tamaños de escritorio
y móvil, código largo, foco, navegación y redimensionado. La comprobación con
lectores de pantalla y dispositivos móviles físicos sigue pendiente; véase
[INCREMENT-4.md](INCREMENT-4.md).

### Renderizado seguro de Markdown

`MarkdownRenderer` recibe únicamente la cadena `markdown` y usa react-markdown.
Soporta CommonMark: encabezados, párrafos, negrita, cursiva, listas ordenadas y no
ordenadas, enlaces, citas, separadores, código en línea y bloques de código.
Los estilos Tailwind están acotados a `.terminal-markdown`, con jerarquía de
encabezados, resultados claros, enlaces subrayados y foco visible. El acento de
los enlaces proviene de `site.theme.accentColor`. Los bloques preservan espacios,
limitan su ancho, admiten desplazamiento horizontal y reciben foco de teclado.

La configuración usa `skipHtml` y conserva el filtro `defaultUrlTransform` de la
biblioteca, restringido además a HTTP, HTTPS, mailto y referencias relativas o
fragmentos. Rechaza controles, barras invertidas y protocolos no permitidos. Las
URLs bloqueadas se muestran como texto sin enlace. Los enlaces web absolutos
(incluidos los que comienzan con `//`) abren una nueva pestaña con
`rel="noopener noreferrer"`; enlaces relativos, fragmentos y correo conservan su
comportamiento nativo sin abrir una pestaña nueva. Las referencias relativas se
resuelven por el navegador respecto a la página, no respecto al archivo Markdown.

No se usa dangerouslySetInnerHTML, rehype-raw ni plugins de Markdown adicionales.
Las imágenes se presentan como texto alternativo, sin elementos `img` ni descargas
implícitas. El renderer no obtiene contenido por HTTP, interpreta comandos o
modifica catálogo/caché. No incorpora resaltado de sintaxis, tablas GFM ni navegación
interna personalizada en esta tarea.

Se sigue la [API y recomendaciones de seguridad de react-markdown](https://github.com/remarkjs/react-markdown#security).
Las pruebas en `tests/terminal/MarkdownRenderer.test.tsx` verifican los elementos
soportados, aislamiento de enlaces, URLs peligrosas, omisión de HTML, conservación
del código y los resultados text/list/error/clear. Las pruebas de sesión siguen
comprobando que clear conserva la bienvenida y el historial de comandos.

## Forma de trabajo

La preparación de GitHub Pages está documentada en [DEPLOYMENT.md](DEPLOYMENT.md).
Vite utiliza `VITE_BASE_PATH` (predeterminado `/terminal-framework/`, `/` para
dominio personalizado). La raíz externa sigue siendo `VITE_CONTENT_BASE_URL`.
El workflow manual verifica instalación, tipos, pruebas y build antes de publicar
solo `dist`; preparar estos archivos no ejecuta una publicación.

- Usar pnpm como gestor de paquetes, con versión fijada en `package.json` y `pnpm-lock.yaml` como único lockfile.
- Avanzar mediante incrementos pequeños, verificables y limitados al alcance acordado.
- Ejecutar las pruebas pertinentes en cada cambio de implementación y comunicar sus resultados; si no pueden ejecutarse, indicar el motivo.
- Mantener separadas la lógica de dominio, la configuración, el acceso a contenidos y la presentación.
- Evitar complejidad prematura, dependencias innecesarias y abstracciones sin un caso de uso actual.
- Actualizar esta documentación cuando cambien las decisiones aprobadas. No convertir cuestiones pendientes en requisitos implícitos.

Los comandos usan una variante más luminosa del acento configurado; los nombres
en help usan una variante más apagada y seminegrita. El historial y los bloques
de código tienen scrollbar delgado con acento de comandos y bordes redondeados
cuando el navegador admite su personalización.
