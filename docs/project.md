# Contexto y arquitectura

terminal-framework permite crear sitios personales explorables mediante una terminal. La aplicación presenta contenidos externos sin incorporar al código la identidad ni los textos de un sitio concreto. El estado actual incluye comandos, Markdown, historial, autocompletado y alternativas ante errores. Consulta [CHANGELOG](../CHANGELOG.md) para las versiones.

## Módulos

React y TypeScript forman la interfaz; Vite genera una SPA estática sin backend propio. Tailwind CSS define estilos, Zod valida configuración y Vitest verifica comportamiento.

| Módulo | Responsabilidad |
| --- | --- |
| `src/app` | Componer servicios y gestionar arranque, sesiones y estados de carga |
| `src/core` | Parser, CommandRegistry, CommandExecutor, CompletionEngine y suggestCommands; sin React, DOM, HTTP ni almacenamiento |
| `src/configuration` | Cargar y validar JSON, referencias y rutas seguras |
| `src/content` | Consultar ContentCatalog, descargar Markdown y mantener la caché en memoria |
| `src/terminal` | Componentes React, useTerminal, interacción y presentación de resultados |
| `src/styles` | Estilos y convenciones visuales |

Reutiliza contratos y reglas existentes; no mantengas copias de configuración ni crees módulos vacíos o abstracciones sin un consumidor real.

## Configuración y arranque

Los esquemas Zod y validadores son la fuente de verdad; los tipos TypeScript se derivan de ellos. Los contratos públicos están en [configuration.md](configuration.md), [commands.md](commands.md) y [content.md](content.md).

`VITE_CONTENT_BASE_URL` define la raíz pública. Las solicitudes omiten credenciales y rechazan redirecciones; la raíz y las rutas tienen validación común. HTTPS es obligatorio salvo HTTP local en desarrollo. El alojamiento debe permitir CORS cuando corresponda.

La aplicación sigue `loadApplication → bootstrapApplication → createCommandRuntime`. Solo entra en ready después de validar los tres JSON, sus referencias, conflictos y todas las rutas del catálogo. Cualquier fallo bloquea el arranque y permite reintentar. La existencia de los Markdown se comprueba al solicitarlos, no al iniciar.

Cada intento comparte una promesa de bootstrap entre activaciones del efecto de StrictMode. Reintentar, cambiar el cargador o montar una aplicación nueva crea otra sesión; no hay caché global. Se retira inmediatamente la sesión anterior al cambiar el cargador, incluso al volver a uno ya utilizado. Los resultados obsoletos de carga o comandos no actualizan una sesión nueva.

Nombre, descripción e idioma actualizan los metadatos HTML. Antes de recibir la configuración, los mensajes usan inglés si el idioma del navegador comienza por en; español en otro caso.

## Core y contenidos

El [motor](core.md) interpreta `comando [argumento]` y devuelve datos estructurados. El ejecutor recibe un servicio de contenidos inyectado; no conserva historial ni realiza HTTP. La resolución al ejecutar distingue mayúsculas y minúsculas, mientras que las coincidencias y alternativas ignoran el caso.

ContentCatalog consulta metadatos validados sin red. MarkdownContentProvider descarga texto usando ese catálogo y el resolver común de rutas. ContentCache comparte solicitudes por ID, conserva éxitos y elimina rechazos para permitir reintentos. Vive en memoria por instancia de proveedor y sesión, sin persistencia. clear no vacía la caché.

createContentService y createCommandRuntime componen una vez por sesión el servicio, registro, ejecutor y completado. CompletionEngine consulta esos mismos metadatos, sin descargar Markdown ni ejecutar sugerencias.

## Terminal

useTerminal posee commandHistory y entries: registra cada instrucción aceptada una vez, conserva texto original y estados pending/success/error. El ejecutor recibe solo el historial anterior; history incluye la ejecución actual una vez. clear vacía la salida visual y conserva bienvenida, comandos y caché.

El envío tiene bloqueo síncrono; mientras espera, el campo permanece montado y de solo lectura. Enter ignora composición IME y eventos repetidos. Los errores esperados son recuperables; una excepción inesperada se muestra sin exponer su causa de depuración.

TerminalPrompt es una entrada controlada. Con lista cerrada, ↑/↓ sin modificadores recorren el historial y conservan el borrador; editar una instrucción recuperada no altera el original. Con lista abierta recorren las opciones. Tab completa al final de la entrada, Escape cierra y Enter ejecuta el texto literal sin elegir automáticamente. El clic completa sin ejecutar. Los detalles de interacción están en [commands.md](commands.md#completar-con-tab).

La entrada recibe foco inicial sin desplazar la página y muestra foco visible. No lo recupera al salir ni al terminar comandos. Shift+Tab, Tab sin coincidencias o sin cambio pendiente y las flechas modificadas conservan su comportamiento nativo. La lista usa combobox/listbox con opción activa, scroll interno y sin región live que anuncie todas las opciones.

La página ocupa 100dvh. La salida tiene scroll local y el prompt permanece al pie. Sigue resultados si el visitante estaba a 64 px o menos del final; si lee contenido anterior, conserva su posición. Los documentos largos comienzan desde el inicio de su ejecución. Redimensionar no reinicia el seguimiento; clear vuelve al comienzo del panel. Se respeta prefers-reduced-motion y no se usa scrollIntoView ni scroll global. El historial no anuncia documentos completos; se anuncian solo espera y mensajes de error.

MarkdownRenderer recibe únicamente texto y usa react-markdown con skipHtml, sin plugins ni HTML crudo. Restringe URLs a HTTP, HTTPS, mailto y referencias relativas o fragmentos. Los enlaces web absolutos abren otra pestaña con noopener noreferrer; los demás conservan navegación nativa. Los enlaces relativos se resuelven respecto a la página, no al Markdown. Las imágenes se presentan como texto alternativo sin descarga. Los bloques de código admiten foco y scroll horizontal.

## Límites y mantenimiento

No hay shell, flags, búsqueda, categorías, plugins, persistencia de sesión, reintentos automáticos, tablas GFM ni resaltado de sintaxis. Los temas personalizados requieren revisar contraste. El esquema admite nombres con guion inicial aunque el parser los rechaza; evitarlos, como indica el contrato, sin cambiar sus reglas incidentalmente.

Quedan pendientes verificación con lectores de pantalla y dispositivos móviles físicos, una demostración visual y traducción inglesa. El funcionamiento y CORS del alojamiento real requieren comprobación al publicar; un build local no los certifica.

Usa [desarrollo](development.md) y [despliegue](deployment.md) para reproducción y publicación. Pruebas, fixtures y utilidades viven en tests; las muestras nunca se publican en dist.

El proyecto es de mantenimiento personal y no acepta contribuciones externas; permite copias y forks independientes según [CONTRIBUTING](../CONTRIBUTING.md). [MIT](../LICENSE) cubre el framework; los contenidos personales tienen una decisión de licencia separada.
