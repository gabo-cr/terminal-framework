# Motor de comandos

El motor recibe instrucciones de texto y produce datos. No renderiza UI, navega,
realiza HTTP ni conserva historial. Las configuraciones y el catálogo deben haber
superado el bootstrap antes de crear el registro y el servicio de contenidos.

## Flujo y responsabilidades

1. `parseCommand(input)` recorta espacios y devuelve `valid`, `empty` o `error`.
2. `CommandRegistry.find(name)` resuelve exactamente el nombre o alias.
3. `CommandExecutor.execute(input, context)` despacha al comportamiento interno o
   consulta el servicio de contenidos. Siempre devuelve `Promise<CommandResult[]>`.
4. El consumidor interpreta los resultados y conserva su historial y salida visual.

Los módulos de producción de `src/core` importan en tiempo de ejecución únicamente
otros módulos del Core. Los contratos de configuración y `ContentService` se
reutilizan mediante `import type`; no incorporan React, Zod ni transporte al motor.
Las reglas de nombres reservados y conflictos están centralizadas en
`commandNames.ts`, compartidas con la validación de configuración.

## Registro y comandos

`new CommandRegistry(configuration.commands.commands)` registra `help`, `clear` y
`history` primero y después los comandos personalizados en el orden recibido.
`list()` no duplica alias. `find(alias)` devuelve la misma definición que
`find(name)`. Las definiciones, los alias y el listado están congelados en ejecución.
El constructor rechaza conflictos con `CommandRegistryError`, código
`COMMAND_CONFLICT`, y las ubicaciones de ambos usos. No repite los esquemas Zod.

| Instrucción | Resultado |
| --- | --- |
| Entrada vacía | Arreglo vacío; no consulta contenidos. |
| `help` | Ayuda ordenada con descripciones y usos. |
| `help nombre-o-alias` | Ayuda específica con nombre canónico. |
| `clear` | Acción para borrar únicamente la salida visual. |
| `history` | Instrucciones anteriores y actual, numeradas desde uno. |
| Comando `document` | Markdown del documento referenciado; no acepta argumento. |
| Comando `collection` | Markdown introductorio y sugerencia localizada de `nombre list`. |
| `collection list` | Metadatos de todos los documentos enumerados, en orden, sin cargar Markdown. |
| `collection id` | Markdown si el ID está enumerado o es la introducción. |

`clear` e `history` rechazan argumentos. `list` es literal y sensible a mayúsculas.
Las descripciones, títulos y cuerpos personalizados no se traducen. Los mensajes
internos usan `locale: 'es' | 'en'` recibido al construir el ejecutor. La introducción
solo aparece en el listado si figura en `collection.documents`.

## Contexto e historial

El ejecutor recibe `{ history: readonly string[] }` en cada ejecución. Este arreglo
contiene **solo las instrucciones anteriores**, en orden cronológico. `history`
añade el texto actual a su resultado sin mutar el arreglo. El consumidor registra
la instrucción actual exactamente una vez y conserva su texto original.

Ejemplo de integración secuencial, sin UI:

```ts
const registry = new CommandRegistry(configuration.commands.commands)
const executor = new CommandExecutor({
  registry,
  content: contentService,
  locale: configuration.site.locale,
})
const history: string[] = []

async function submit(input: string) {
  const results = await executor.execute(input, { history })
  if (parseCommand(input).status !== 'empty') history.push(input)
  return results
}
```

El ejemplo registra también instrucciones fallidas. El motor no decide la política
de persistencia ni coordina envíos simultáneos. La capa de sesión debe
mantener el orden de envío y evitar añadir la instrucción actual antes de pasar el
contexto, para no duplicarla en `history`.

## Servicio de contenidos

`src/content/ContentService.ts` es una interfaz inyectable:

- `getDocument(id)`: metadatos del catálogo, o `undefined`.
- `getCollection(id)`: definición de colección, o `undefined`.
- `getMarkdown(documentId)`: `Promise<string>` con el cuerpo original.

Las dos consultas de catálogo son síncronas. La carga del cuerpo es asíncrona.
El ejecutor rechaza IDs ajenos antes de consultar el documento. Si un listado falla,
no se devuelve un listado parcial; si falla la introducción, tampoco se devuelve
su sugerencia. En el Incremento 3, createContentService implementa este contrato mediante catálogo, proveedor HTTP y caché, inyectados desde app. El Core sigue sin conocer el transporte.

## Resultados y errores

`CommandResult` es una unión discriminada por `type`. Una ejecución puede producir
varios resultados ordenados, como `[markdown, text]` para una introducción.

| `type` | Datos principales |
| --- | --- |
| `help` | `scope`, `title`, `commands` con descripciones, alias y usos. |
| `history` | `entries` con `number` e `input`. |
| `clear` | Acción sin historial ni referencias a UI. |
| `text` | `text`. |
| `markdown` | `documentId`, `title`, `markdown`. |
| `list` | `title`, `items` con ID, título y descripción opcional. |
| `error` | `code`, `message` y detalles según el error. |

| Código | Significado |
| --- | --- |
| `TOO_MANY_ARGUMENTS` | Más de un argumento. |
| `UNSUPPORTED_SYNTAX` | Flags o sintaxis de shell fuera del MVP. |
| `COMMAND_NOT_FOUND` | Nombre o alias desconocido, también en ayuda específica. |
| `INVALID_ARGUMENTS` | Argumento para un comando que no lo admite. |
| `DOCUMENT_NOT_FOUND` | Documento ausente del servicio de catálogo. |
| `COLLECTION_NOT_FOUND` | Colección ausente del servicio de catálogo. |
| `DOCUMENT_NOT_IN_COLLECTION` | ID que no pertenece a la colección. |
| `CONTENT_ERROR` | Excepción síncrona o rechazo asíncrono del servicio. |

Los errores esperados se devuelven como resultados. `CONTENT_ERROR` conserva
`cause: unknown` para depuración; no debe suponerse serializable ni mostrarse como
mensaje al visitante. `commandNotFoundResult` comparte el mensaje localizado entre
el ejecutor y la ayuda, sin volver a buscar el comando.

## Verificación del incremento

`tests/core/engine.integration.test.ts` conecta bootstrap con JSON simulados, parser, registro,
comandos internos, ejecutor y un servicio de Markdown en memoria. No sustituye los
módulos del Core por mocks. Prueba sesiones completas en ambos idiomas, orden,
alias, errores, recuperación y aislamiento de historiales. Falla si se usa el
`fetch` global o se carga React a través del motor. El transporte de configuración
recibe un `fetch` simulado separado.

```sh
pnpm run test
pnpm run typecheck
pnpm run typecheck:core
pnpm run build
```

`typecheck:core` compila los módulos de producción del motor con `ES2023`, sin DOM
ni tipos ambientales de Vite. La revisión estática de imports complementa esta
comprobación. No existe un comando de lint configurado.

La terminal React utiliza este motor a través de useTerminal, que conserva los
historiales y coordina envíos. La presentación Markdown permanece en src/terminal.

## Arranque integrado con contenidos reales

```ts
const { configuration, content, executor } = await bootstrapApplication({
  baseUrl: contentBaseUrl,
  fetch: fetchImplementation, // opcional; por defecto usa Fetch del entorno
  development: false,
})
const results = await executor.execute('help', { history: [] })
// Reutilizar executor y content en todas las instrucciones de esta sesión.
```

La función de app valida los tres JSON y crea los componentes una sola vez.
`createCommandRuntime` permite la misma composición cuando la configuración ya
está validada. `content.clearCache()` es una operación interna independiente del
comando visual `clear`. No cambia el contrato de resultados del motor ni convierte
Markdown a HTML.

`tests/app/contents.integration.test.ts` verifica el trayecto completo con catálogo,
proveedor HTTP y caché reales y respuestas Fetch simuladas: documentos, colecciones,
alias, internos, mensajes es/en, errores recuperables, reintentos, aislamiento de
sesiones y solicitudes simultáneas. La suite del Incremento 2 se conserva.

## Incremento 7: completado y alternativas de error

`CompletionEngine` es independiente de React. Recibe `CompletionEngineOptions` con el registro existente, un `catalog` que expone las consultas síncronas `getDocument` y `getCollection` y un idioma opcional (`es` predeterminado). Puede usar ContentCatalog directamente o las consultas del servicio compuesto; no se crea otro catálogo ni se carga Markdown.

`complete(input): CompletionResult` asume que el cursor está al final del campo:

- `{ type: 'empty' }`: entrada vacía, sintaxis fuera de alcance o ninguna coincidencia.
- `{ type: 'candidate', candidate }`: una coincidencia.
- `{ type: 'suggestions', suggestions }`: varias coincidencias.

Cada `CompletionSuggestion` contiene `name`, `description` cuando existe, `kind` (`command`, `alias`, `document` o `list`) e `insertValue`, la entrada completa que un consumidor podría insertar sin ejecutarla. Los comandos internos reutilizan las descripciones localizadas de help. La búsqueda por prefijo no distingue mayúsculas, pero la ejecución conserva la resolución exacta existente.

Se sugieren nombres y alias en orden del registro, colocando los alias inmediatamente después de su comando. `help ` ofrece esos mismos tokens. Los argumentos de colecciones ofrecen primero `list`, después los documentos en su orden configurado y finalmente la introducción si no estaba enumerada. Se eliminan duplicados por nombre sin distinguir mayúsculas. Se resuelven alias de colección y se conserva exactamente el token de comando y los separadores al construir insertValue. No hay argumentos para comandos document, clear o history.

No se completan flags, comillas, entradas multilínea, múltiples argumentos ni un tercer token tras un argumento y un espacio. Los nombres que comienzan por guion se excluyen, dado que el parser no puede ejecutarlos. El parser y los contratos JSON no cambian.

`suggestCommands(name, registry): string[]` devuelve hasta tres nombres o alias registrados con distancia de edición conservadora, incluyendo transposiciones adyacentes. Compara sin distinguir mayúsculas: tokens de menos de tres caracteres solo admiten distancia cero; entre tres y cinco, una edición; desde seis, dos. El límite se calcula sobre el token más corto. Se ordena por distancia y, en empate, por orden del registro y alias; no ejecuta alternativas.

`COMMAND_NOT_FOUND`, incluido el destino de `help`, incorpora `suggestions?: readonly string[]` solo cuando hay alternativas. Conserva código, mensaje localizado y comando original. No cambian los demás errores. TerminalOutput conserva el mensaje y muestra hasta tres alternativas con una etiqueta localizada. TerminalPrompt consume complete para Tab y su lista accesible, sin trasladar lógica de coincidencias a React.

`createCommandRuntime` devuelve `{ content, executor, completion }`, componiendo el motor de completado una vez por sesión con las consultas del catálogo existente. bootstrapApplication expone también completion. La versión del paquete permanece en 0.1.0 hasta una decisión explícita de publicación.
