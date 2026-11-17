# Motor de comandos

Core recibe texto y devuelve datos; no importa React, DOM, HTTP ni almacenamiento. Reutiliza los tipos de configuración y ContentService mediante `import type`. Las reglas de nombres y conflictos están centralizadas en commandNames.ts y se comparten con la validación de configuración.

## Registro y ejecución

`CommandRegistry` recibe comandos personalizados ya validados. Registra primero help, clear e history y después los personalizados en su orden original. `find(name)` resuelve nombres y alias exactamente; `list()` devuelve definiciones únicas, sin duplicarlas por alias. Definiciones, alias y listado están congelados. El constructor rechaza conflictos con CommandRegistryError (`COMMAND_CONFLICT`), pero no repite esquemas ni validación de referencias.

`parseCommand(input)` devuelve valid, empty o error. Recorta espacios exteriores, conserva los tokens y admite `comando [argumento]`. Las reglas de sintaxis, integrados y colecciones se describen en [commands.md](commands.md).

`CommandExecutor.execute(input, { history })` devuelve `Promise<CommandResult[]>`. Recibe solo instrucciones anteriores; history incluye la ejecución actual una vez. El consumidor registra cada entrada aceptada y mantiene su texto original. El ejecutor no guarda estado de sesión ni coordina envíos simultáneos.

El servicio inyectado expone:

| Operación | Resultado |
| --- | --- |
| `getDocument(id)` | Metadatos de documento o undefined, sincrónicamente |
| `getCollection(id)` | Colección o undefined, sincrónicamente |
| `getMarkdown(documentId)` | Promise con el texto Markdown original |

El motor verifica pertenencia antes de pedir un documento de colección. Un listado usa solo metadatos, sin cuerpos Markdown. Un fallo no devuelve un listado parcial ni la sugerencia posterior a una introducción fallida.

## Resultados y errores

CommandResult es una unión discriminada por type:

| Tipo | Datos |
| --- | --- |
| `help` | scope, title y commands con nombre, descripción, alias y usos |
| `history` | entries con number e input |
| `clear` | Petición para vaciar únicamente la salida visual |
| `text` | text |
| `markdown` | documentId, title y markdown |
| `list` | title e items con ID, título y descripción opcional |
| `error` | code, message y detalles según el error |

Una ejecución puede devolver varios resultados ordenados, como introducción Markdown y sugerencia de listado. Los mensajes internos usan es/en; los títulos y descripciones personalizados no se traducen.

Los [códigos de error](commands.md#errores-durante-una-ejecución) se conservan como datos recuperables. CONTENT_ERROR mantiene cause para depuración: no debe suponerse serializable ni mostrarse al visitante. COMMAND_NOT_FOUND puede incluir `suggestions?: readonly string[]`; conserva el mensaje localizado y el comando original, también para destinos desconocidos de help.

## Completado y alternativas de error

`CompletionEngine` recibe `CompletionEngineOptions`:

- `registry`: CommandRegistry existente.
- `catalog`: consultas getDocument y getCollection del catálogo validado. Acepta ContentCatalog o las consultas del servicio compuesto.
- `locale`: es/en opcional, con es predeterminado.

`complete(input): CompletionResult` considera el cursor al final de la entrada y devuelve:

- `{ type: 'empty' }`: entrada vacía, sintaxis no admitida o ninguna coincidencia.
- `{ type: 'candidate', candidate }`: una coincidencia.
- `{ type: 'suggestions', suggestions }`: varias coincidencias.

Cada CompletionSuggestion contiene name, description cuando existe, kind (`command`, `alias`, `document` o `list`) e insertValue: la entrada completa que el consumidor podría insertar sin ejecutarla. Los comandos internos reutilizan las descripciones de help.

Las coincidencias por prefijo ignoran mayúsculas, pero no cambian la resolución exacta al ejecutar. Se conserva el comando o alias escrito y sus separadores al completar argumentos. Los nombres y alias se ofrecen en orden del registro, con los alias inmediatamente después de su comando. help ofrece los mismos tokens. Para colecciones: list primero, documentos en orden configurado y finalmente la introducción si no estaba enumerada. Se eliminan duplicados sin distinguir el caso y no aparecen documentos de otras colecciones.

No hay argumentos para document, clear o history. No se completan flags, comillas, entradas multilínea, múltiples argumentos ni un tercer token tras un argumento y un espacio. Se excluyen nombres con guion inicial porque no son ejecutables por el parser. Ninguna sugerencia descarga Markdown ni ejecuta comandos.

`suggestCommands(name, registry): string[]` devuelve hasta tres nombres o alias cercanos. Usa distancia de edición con transposiciones adyacentes e ignora mayúsculas. El límite depende del token más corto: menos de tres caracteres exige distancia cero; entre tres y cinco admite una edición; desde seis admite dos. Ordena por distancia y, en empate, por orden del registro y alias, sin duplicados. Si no hay alternativas, el error no añade suggestions.

TerminalPrompt consume complete y gestiona la lista accesible sin copiar las coincidencias en React. TerminalOutput muestra hasta tres alternativas bajo el error sin ejecutarlas. La interacción de teclado y foco está en [commands.md](commands.md#completar-con-tab).

## Composición

`createCommandRuntime` devuelve `{ content, executor, completion }`, reutilizando registro y catálogo y componiendo una vez por sesión. bootstrapApplication carga y valida la configuración antes de devolverlos:

```ts
const { executor, completion } = await bootstrapApplication({
  baseUrl: contentBaseUrl,
  fetch: fetchImplementation, // opcional: Fetch del entorno por defecto
  development: false,
})
const options = completion.complete('he')
const results = await executor.execute('help', { history: [] })
```

La capa React mantiene los historiales mediante useTerminal y bloquea envíos pendientes. content.clearCache es una operación interna independiente del comando clear.

## Verificación

`tests/core/` cubre parser, registro, integrados, ejecución, completado y alternativas. La integración verifica sesiones es/en sin React ni Fetch global en el motor. `tests/app/` cubre bootstrap, proveedor y caché reales con Fetch simulado y servidores HTTP locales. `typecheck:core` comprueba los módulos con ES2023, sin DOM ni tipos ambientales de Vite.

Los comandos disponibles y la reproducción están en [development.md](development.md).
