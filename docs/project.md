# terminal-framework: contexto del proyecto

## Visión y alcance actual

Framework open source para sitios personales cuya interfaz principal es una terminal interactiva. El visitante descubre textos, proyectos e ideas mediante comandos sencillos. La versión 0.1.0 es el primer MVP público; no promete la estabilidad de una versión 1.0.

El framework es reutilizable mediante configuración y contenidos externos. La identidad y los textos de un sitio no deben quedar incorporados al código de la aplicación.

## Arquitectura aprobada

React, TypeScript, Vite, Tailwind CSS, Zod y Vitest. La aplicación es una SPA estática publicable en GitHub Pages, sin backend propio.

| Módulo | Responsabilidad |
| --- | --- |
| `src/app` | Composición, arranque, sesiones y estados de inicialización |
| `src/core` | Parser puro, CommandRegistry, comandos internos y CommandExecutor; independiente de React, DOM, HTTP y almacenamiento |
| `src/configuration` | Carga remota de JSON, esquemas, referencias y resolución segura de URLs |
| `src/content` | Catálogo validado, descarga de Markdown y caché en memoria |
| `src/terminal` | Componentes React, useTerminal, presentación Markdown e interacción |
| `src/styles` | Estilos globales y convenciones visuales |

No crear módulos vacíos ni abstracciones especulativas. Compartir únicamente tipos y reglas que tengan consumidores reales.

## Contratos públicos

Los esquemas Zod y validadores del código son la fuente de verdad. Los tipos TypeScript se derivan de los esquemas; no mantener copias de contratos o reglas de rutas en otros módulos.

- [site.json](configuration.md): nombre, descripción, idioma es/en, bienvenida y tema.
- [commands.json](commands.md): comandos de documento y colección, alias y referencias.
- [content.json](content.md): IDs globales, documentos Markdown, introducciones y listas ordenadas.

Los tres archivos requieren versión numérica 1 y objetos estrictos. El bootstrap valida esquemas, referencias, conflictos y todas las rutas del catálogo antes de devolver una configuración completa. Cualquier fallo impide `ready`; no existe arranque parcial. La existencia remota de los Markdown no se comprueba al iniciar.

La raíz externa proviene de `VITE_CONTENT_BASE_URL`. Requiere HTTPS, salvo HTTP en desarrollo con localhost, 127.0.0.1 o [::1]. Las solicitudes omiten credenciales y rechazan redirecciones; el servidor debe permitir CORS cuando corresponda. Todos los documentos se resuelven dentro de la raíz mediante las mismas reglas de rutas seguras.

## Motor y contenidos

El [motor de comandos](core.md) admite `comando [argumento]`, con help, clear e history integrados. No interpreta shell, flags, búsqueda, categorías ni plugins. Resuelve nombres y alias exactamente, sin normalizar mayúsculas. Una colección permite abrir introducción, listar todos sus documentos en orden y abrir un documento enumerado o la introducción por su ID global. `list` está reservado como argumento de colección.

ContentCatalog recibe el catálogo validado; consulta metadatos sin HTTP. MarkdownContentProvider descarga texto público usando el catálogo y el resolver de rutas existente. ContentCache comparte solicitudes por ID, conserva los éxitos y elimina los rechazos para permitir reintentos. La caché es en memoria, por instancia de proveedor y sesión, sin almacenamiento persistente. Su limpieza interna no está vinculada a clear.

createContentService y createCommandRuntime componen las instancias una vez tras validar la configuración. El ejecutor recibe el servicio de contenidos inyectado y no conserva historial ni conoce el transporte. Conserva los códigos de error y la unión CommandResult existentes.

## Arranque y ciclo de vida

La aplicación sigue `loadApplication → bootstrapApplication → createCommandRuntime`. React se monta inmediatamente y presenta loading, ready o error con reintento.

Cada intento conserva una única promesa de bootstrap entre las activaciones de efecto de StrictMode. No hay caché global de inicialización: reintentar, cambiar el cargador o montar una aplicación nueva crea otra sesión. Al cambiar de cargador se retira la sesión anterior de inmediato; volver a uno ya usado no reutiliza su sesión. Las respuestas de intentos descartados y comandos de terminales desmontadas no actualizan la sesión nueva.

El nombre, descripción e idioma actualizan título HTML, meta descripción e idioma del documento. Antes de recibir la configuración, los mensajes usan inglés si el idioma del navegador comienza por en; español en otro caso.

## Terminal e interacción

TerminalPrompt es una entrada controlada con etiqueta accesible y atributo name. Enter acepta una entrada no vacía y vacía el campo. No envía durante composición IME ni con eventos repetidos. Un bloqueo síncrono impide aceptar envíos simultáneos; durante una ejecución el input permanece montado y de solo lectura.

useTerminal conserva dos historiales: commandHistory registra las instrucciones originales, incluidas fallidas y clear; entries conserva la salida visual con IDs y estados pending, success o error. El ejecutor recibe una copia del historial anterior, antes de registrar la instrucción actual. history incluye la ejecución actual exactamente una vez. clear vacía solo entries y conserva bienvenida, comandos y caché.

Las flechas arriba y abajo recorren el historial sin ejecutarlo. Conservan el borrador al iniciar la navegación y lo restauran al volver al final. Editar una instrucción recuperada cambia solo la entrada; enviar reinicia la navegación. No se interceptan flechas modificadas ni navegación durante una ejecución.

### Foco y desplazamiento

El input recibe foco al montar mediante `focus({ preventScroll: true })`. Conserva el cursor nativo y su etiqueta; no muestra contorno. No captura blur ni Tab/Shift+Tab: el visitante puede enfocar enlaces, bloques de código, botones y la región de historial. Finalizar una ejecución no roba el foco ni al input ni a otro control.

La página ocupa 100dvh; el historial tiene desplazamiento local y el prompt permanece al pie. El tamaño base de terminal es 13 px con interlineado de 20 px; el input móvil usa 16 px para evitar zoom. El panel sigue las actualizaciones si el visitante estaba a 64 px o menos del final; conserva la posición si lee contenido anterior. Los documentos largos se muestran desde el inicio de su ejecución reciente. Redimensionar no reinicia el seguimiento. Clear vuelve al comienzo del panel.

No se usa scrollIntoView ni desplazamiento global. Se respeta prefers-reduced-motion; el historial no es una región live y no anuncia documentos completos. El estado pendiente anuncia solo la espera; los errores muestran su mensaje con role=alert sin exponer la causa de depuración.

### Markdown y presentación

MarkdownRenderer recibe una cadena y usa react-markdown con skipHtml, sin HTML crudo ni plugins adicionales. Conserva el filtro de URLs de la biblioteca y restringe enlaces a HTTP, HTTPS, mailto y referencias relativas o fragmentos. Los enlaces bloqueados se muestran como texto. Los enlaces web absolutos abren otra pestaña con noopener noreferrer; los demás conservan navegación nativa. Las imágenes se muestran como texto alternativo sin descargas implícitas.

El renderer no obtiene contenidos, ejecuta comandos ni modifica la caché. Los bloques de código admiten scroll horizontal y foco de teclado sin ensanchar la página. No hay tablas GFM ni resaltado de sintaxis.

Los comandos usan una variante luminosa del acento configurado. La ayuda presenta comando y usos en una columna y descripción en otra. Un separador tenue distingue el input de las respuestas. El scrollbar es delgado y redondeado donde el navegador lo admite. El autor de cada tema debe revisar su contraste.

## Desarrollo y reproducción

La [guía de desarrollo](development.md) contiene los pasos vigentes para fixtures, comprobaciones y revisión manual. Las pruebas están en tests, los datos ficticios en tests/fixtures y las utilidades en tests/support. No incluir muestras estáticas en producción ni public.

Usar pnpm según packageManager y conservar pnpm-lock.yaml como único lockfile. Trabajar de forma incremental, conservar cambios existentes y comprobar el comportamiento afectado. Actualizar documentación al aprobar cambios de alcance. No añadir funcionalidades fuera del incremento solicitado.

La [guía de despliegue](deployment.md) documenta VITE_BASE_PATH, HTTPS, CORS y el workflow manual que publica solo dist. La verificación real de Pages depende del alojamiento y no se sustituye con un build local.

## Mantenimiento y licencia

El repositorio no acepta ni revisa contribuciones externas. Se permiten copias y forks independientes, sin obligación de devolver cambios. Véase [la política de reutilización](../contributing.md).

El framework se distribuye bajo [MIT](../LICENSE), con `Copyright (c) 2026 Gabriel Chávez Riera`. Los contenidos personales tienen una decisión de licencia separada.

Los informes de incrementos anteriores no son necesarios para trabajar en nuevas tareas: los contratos, arquitectura y reproducción vigentes están consolidados en estas guías. El historial de Git conserva la documentación eliminada que estuvo versionada.

## Límites conocidos de 0.1.0

Quedan pendientes pruebas con lectores de pantalla y dispositivos móviles físicos, una demostración visual y una traducción inglesa. La disponibilidad y CORS de contenidos reales se verifican al publicar. Los esquemas admiten nombres que empiezan por guion, aunque el parser los rechaza; evitar esos nombres, tal como explica commands.md. Resolver ese matiz antes de prometer contratos estables de una versión 1.0.

## Alcance autorizado del Incremento 7

El Core incorpora CompletionEngine y suggestCommands, sin React, HTTP ni nuevas dependencias. Reutiliza CommandRegistry y las consultas síncronas de ContentCatalog a través del servicio existente. createCommandRuntime compone completion una vez por sesión. COMMAND_NOT_FOUND admite alternativas opcionales, sin cambiar su código ni mensaje ni otros errores. No se modifican los contratos JSON ni el parser. Las interfaces, orden y umbrales se documentan en [core.md](core.md). No se implementa aún la lista visual de sugerencias ni la interacción de autocompletado en el input.
