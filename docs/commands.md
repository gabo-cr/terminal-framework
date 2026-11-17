# Comandos: commands.json

`config/commands.json` define las entradas con las que se explora el sitio. No contiene código ejecutable: cada comando personalizado abre un documento o una colección del [catálogo](content.md).

## Estructura del archivo

| Campo raíz | Tipo | Obligatorio |
| --- | --- | --- |
| `version` | Número literal `1` | Sí |
| `commands` | Arreglo de comandos personalizados | Sí; puede estar vacío |

No hay valores predeterminados para estos campos. Todos los objetos rechazan propiedades desconocidas y ninguno de los campos admite `null`.

### Comandos integrados

Siempre están disponibles; no se declaran en el JSON:

| Comando | Comportamiento |
| --- | --- |
| `help` | Ayuda general: integrados primero (`help`, `clear`, `history`), después personalizados en orden de configuración |
| `help <comando>` | Ayuda específica; acepta nombre o alias y presenta el nombre canónico |
| `clear` | Limpia la salida visual sin borrar bienvenida, historial de comandos ni caché de documentos |
| `history` | Muestra los comandos de la sesión en orden, numerados desde uno, incluida la invocación actual |

### Propiedades de comandos personalizados

| Campo | Tipo y regla | Presencia |
| --- | --- | --- |
| `type` | Literal `document` o `collection` | Obligatoria |
| `name` | Cadena que cumple `^[a-z0-9-]+$`, no reservada | Obligatoria |
| `description` | Cadena con texto no vacío; conserva sus espacios | Obligatoria |
| `aliases` | Arreglo de nombres con las mismas reglas que `name`; puede ser vacío | Opcional, sin valor predeterminado |
| `content` | ID global de documento | Obligatoria solo para `document`; prohibida para `collection` |
| `collection` | ID de colección | Obligatoria solo para `collection`; prohibida para `document` |

Las referencias siguen el formato de [IDs del catálogo](content.md#identificadores-y-referencias). Un comando `document` no acepta argumentos. Un comando `collection` admite la introducción, el listado y la lectura por ID.

### Alias y nombres reservados

`help`, `clear` e `history` están reservados, tanto como nombres como alias. Todos los nombres y alias deben ser únicos en el conjunto de comandos: se rechazan alias repetidos, alias iguales al propio nombre y colisiones entre comandos. Un alias conduce al mismo comportamiento; la ayuda específica y la sugerencia de ejecutar list usan el nombre canónico. El autocompletado y las alternativas ante errores pueden ofrecer también alias.

Los nombres admiten letras ASCII minúsculas, números y guiones, sin espacios ni guiones bajos. Su patrón es más permisivo que el de los IDs: el esquema admite guiones iniciales o repetidos. Sin embargo, el parser rechaza cualquier token que empiece por `-`; evita nombres y alias con ese comienzo para que puedan invocarse.

`list` no está reservado como nombre de comando global. Su significado especial es como argumento de una colección.

## Ejemplo válido

Este archivo se combina con el catálogo completo de [content.json](content.md#ejemplo-completo):

```json
{
  "version": 1,
  "commands": [
    {
      "type": "document",
      "name": "inicio",
      "description": "Presentación del cuaderno.",
      "aliases": ["portada"],
      "content": "intro"
    },
    {
      "type": "collection",
      "name": "notas",
      "description": "Explora todas las notas.",
      "aliases": ["textos"],
      "collection": "notas"
    }
  ]
}
```

También es válido no añadir comandos personalizados:

```json
{
  "version": 1,
  "commands": []
}
```

## Sintaxis y listados

La sintaxis es `comando [argumento]`: los corchetes indican un argumento opcional, no se escriben. Se recortan espacios exteriores y se admiten espacios o tabulaciones entre tokens. Las búsquedas distinguen mayúsculas y minúsculas. Una entrada vacía no ejecuta nada.

No se interpretan instrucciones del sistema: se rechazan flags (tokens que empiezan por `-`), comillas, backticks, barras invertidas, pipes, redirecciones, `;`, `&` y saltos de línea internos. La sintaxis no admitida tiene prioridad sobre el exceso de argumentos.

Con el ejemplo anterior:

| Entrada | Resultado |
| --- | --- |
| `inicio` o `portada` | Markdown de `intro` |
| `notas` | Markdown de la introducción y sugerencia de ejecutar `notas list` |
| `notas list` | Listado completo con ID, título y descripción opcional de cada documento enumerado, en su orden configurado |
| `notas primera-nota` | Markdown de ese documento |
| `notas intro` | Markdown de la introducción, incluso si no aparece enumerada |
| `help textos` | Ayuda del comando canónico `notas` |

`list` no descarga cuerpos Markdown, no pagina y no añade automáticamente la introducción. Un documento global ajeno a la colección no se puede abrir mediante ella.

## Errores de configuración

Un tipo desconocido, propiedad incompatible, nombre reservado o campo inválido produce `SCHEMA_VALIDATION_ERROR`. Las colisiones producen `CROSS_VALIDATION_ERROR` con detalle `COMMAND_CONFLICT`; una referencia inexistente o del tipo equivocado produce detalles `DOCUMENT_NOT_FOUND` o `COLLECTION_NOT_FOUND`. Todos impiden inicializar el sitio, aunque el esquema aislado pueda aceptar una referencia todavía no resuelta.

## Errores durante una ejecución

Estos resultados no cierran la sesión: se puede corregir la entrada o volver a intentar la descarga.

| Código | Caso |
| --- | --- |
| `UNSUPPORTED_SYNTAX` | Sintaxis rechazada por el parser |
| `TOO_MANY_ARGUMENTS` | Más de un argumento |
| `COMMAND_NOT_FOUND` | Comando o destino de ayuda inexistente |
| `INVALID_ARGUMENTS` | Argumentos para `clear`, `history` o un comando `document` |
| `DOCUMENT_NOT_IN_COLLECTION` | ID ajeno a la colección |
| `DOCUMENT_NOT_FOUND`, `COLLECTION_NOT_FOUND` | Destino ausente en el servicio; las referencias inválidas ya se bloquean en el arranque normal |
| `CONTENT_ERROR` | Fallo del servicio, como HTTP 404 de Markdown, red, CORS o redirección rechazada |

Los mensajes internos se presentan en el idioma del sitio. La causa de un fallo de contenidos se conserva para depuración, sin mostrarse al visitante. Una descarga fallida no se guarda en caché y permite volver a ejecutar el comando.

## Fuente del contrato

[Esquema y tipos](../src/configuration/commands.schema.ts), [nombres y conflictos](../src/core/commandNames.ts), [parser](../src/core/parseCommand.ts), [integrados](../src/core/internalCommands.ts) y [ejecutor](../src/core/CommandExecutor.ts). Pruebas: [esquema](../tests/configuration/commands.schema.test.ts), [referencias](../tests/configuration/validateConfiguration.test.ts) y [ejecutor](../tests/core/CommandExecutor.test.ts).

### Alternativas ante comandos desconocidos

El resultado estructurado COMMAND_NOT_FOUND puede incluir `suggestions`, con hasta tres nombres o alias registrados cercanos al token desconocido. También se aplica al destino desconocido de help. La comparación ignora mayúsculas, pero no cambia la resolución exacta al ejecutar. El código y el mensaje del error se conservan, y la interfaz muestra hasta tres alternativas bajo el mensaje, con la etiqueta «Quizá quisiste decir» o «Did you mean». No las ejecuta automáticamente. Véanse [las interfaces del motor](core.md#completado-y-alternativas-de-error).

### Completar con Tab

Al final de la entrada, Tab completa una coincidencia única o abre una lista si hay varias. La primera opción queda seleccionada; ↑/↓ cambian la selección y Tab la inserta. Clic o toque también completan sin ejecutar. Escape cierra sin cambiar la entrada. Enter cierra y ejecuta exactamente el texto actual, sin insertar la opción seleccionada.

La lista se recalcula al editar y se cierra si no hay coincidencias. No se abre para entrada vacía, durante composición IME o ejecución pendiente ni con el cursor en medio. Shift+Tab y Tab sin coincidencias o con una única opción ya idéntica a la entrada permiten abandonar el campo. Las flechas con modificadores conservan la selección y navegación nativas. Con la lista cerrada, ↑/↓ conservan la navegación por historial y su borrador. El motor admite comandos, alias, argumentos de help y recursos del catálogo de cada colección; no consulta Markdown remoto.
