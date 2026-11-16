# Catálogo de contenidos: content.json

`config/content.json` conecta los comandos con los textos publicados. Describe documentos Markdown y colecciones; los cuerpos de los textos permanecen en archivos separados.

## Estructura y campos

La raíz exige `version` (número literal `1`), `collections` (arreglo) y `documents` (arreglo). Ambos arreglos pueden estar vacíos. No se aplican valores predeterminados. Todos los objetos son estrictos: rechazan propiedades desconocidas. Ningún campo admite `null`.

### Documento

| Campo | Tipo | Obligatorio |
| --- | --- | --- |
| `id` | ID de contenido | Sí |
| `title` | Cadena con texto no vacío | Sí |
| `description` | Cadena; admite vacío o solo espacios | No |
| `path` | Cadena con texto no vacío, que además debe ser una ruta relativa segura | Sí |
| `format` | Literal `markdown` | Sí |

### Colección

| Campo | Tipo | Obligatorio |
| --- | --- | --- |
| `id` | ID de contenido | Sí |
| `title` | Cadena con texto no vacío | Sí |
| `description` | Cadena; admite vacío o solo espacios | No |
| `intro` | ID global de un documento Markdown | Sí |
| `documents` | Arreglo ordenado de IDs globales de documentos, sin repeticiones | Sí; admite vacío |

Las cadenas con texto obligatorio no se recortan ni normalizan. El catálogo y los listados no convierten la descripción en Markdown.

## Identificadores y referencias

Los IDs cumplen `^[a-z0-9]+(?:-[a-z0-9]+)*$`: letras ASCII minúsculas o números, separados opcionalmente por guiones simples. No admiten acentos, espacios, guiones bajos, guiones iniciales/finales ni guiones consecutivos.

Los IDs de documento son globales dentro del catálogo, no locales a cada colección. Cada documento se declara una vez y puede compartirse entre varias colecciones. También puede existir sin pertenecer a ninguna. Las colecciones tienen su propio conjunto de IDs únicos: una colección y un documento pueden compartir ID, pero las referencias deben apuntar al tipo correcto.

Cada `intro` y cada elemento de `documents` debe existir en el arreglo raíz `documents`, incluso si ningún comando abre esa colección. Cada comando `document` debe referenciar un documento y cada comando `collection` una colección.

### Introducción y listado completo

Toda colección necesita una introducción Markdown, aun cuando su lista esté vacía. `intro` es una referencia al documento, no una ruta ni Markdown escrito directamente en el JSON.

Al invocar el comando de colección sin argumento, se descarga la introducción. Puede abrirse también por su ID aunque no esté en `documents`. Puede incluirse una vez en esa lista si se desea que aparezca en el listado.

El argumento `list` muestra todos los documentos enumerados en `documents`, con ID, título y descripción opcional, conservando exactamente el orden declarado. No ordena por fecha ni título, no descarga los cuerpos y no incorpora documentos globales ajenos a la lista. No hay paginación.

`list` está reservado dentro de una colección: no puede ser su `intro` ni un elemento de `documents`. Puede existir como documento global si ninguna colección lo expone.

## Rutas relativas seguras

`path` se resuelve desde `VITE_CONTENT_BASE_URL`, no desde la carpeta `config/` ni desde el archivo Markdown. Por ejemplo, `documents/intro.md` apunta a esa subruta bajo la raíz configurada.

Se rechazan rutas absolutas, URLs completas, barras iniciales, barras invertidas, segmentos vacíos (`//`), segmentos `.` y `..`, consultas, fragmentos, espacios y caracteres de control. También se rechazan sus variantes codificadas peligrosas, porcentajes mal formados y porcentajes residuales tras una decodificación, para impedir ambigüedad por doble codificación. No se exige la extensión `.md`, pero `format` siempre debe ser `markdown`.

La validación revisa todas las rutas, incluso las de documentos sin referencias. Las solicitudes públicas omiten credenciales y rechazan redirecciones. Los enlaces relativos que aparecen dentro del Markdown son distintos de `path`: el navegador los resuelve respecto a la página de la aplicación.

## Ejemplo mínimo válido

Compatible con `commands: []` de la guía de comandos:

```json
{
  "version": 1,
  "collections": [],
  "documents": []
}
```

## Ejemplo completo

Compatible con el ejemplo completo de [commands.json](commands.md#ejemplo-válido) y cualquiera de los ejemplos de [site.json](configuration.md):

```json
{
  "version": 1,
  "collections": [
    {
      "id": "notas",
      "title": "Notas abiertas",
      "description": "Una colección de textos breves.",
      "intro": "intro",
      "documents": ["primera-nota", "segunda-nota"]
    }
  ],
  "documents": [
    {
      "id": "intro",
      "title": "Presentación",
      "description": "Cómo recorrer este cuaderno.",
      "path": "documents/intro.md",
      "format": "markdown"
    },
    {
      "id": "primera-nota",
      "title": "Primera nota",
      "path": "documents/primera-nota.md",
      "format": "markdown"
    },
    {
      "id": "segunda-nota",
      "title": "Segunda nota",
      "path": "documents/segunda-nota.md",
      "format": "markdown"
    }
  ]
}
```

Para leer los textos, publica los tres archivos Markdown en esas rutas. El ejemplo valida el contrato y sus referencias; no presupone que esos archivos estén publicados.

## Errores al iniciar y al leer

Las estructuras, IDs, formatos o duplicados inválidos producen `SCHEMA_VALIDATION_ERROR` e impiden el arranque. Las referencias y rutas se revisan después de los esquemas; producen `CROSS_VALIDATION_ERROR` con detalles:

| Detalle | Motivo |
| --- | --- |
| `DOCUMENT_NOT_FOUND`, `COLLECTION_NOT_FOUND` | Destino de un comando inexistente o de tipo equivocado |
| `INTRO_NOT_FOUND` | Introducción ausente del catálogo |
| `COLLECTION_DOCUMENT_NOT_FOUND` | Documento enumerado ausente del catálogo |
| `RESERVED_COLLECTION_DOCUMENT` | ID `list` expuesto por una colección |
| `UNSAFE_DOCUMENT_PATH` | Ruta de documento rechazada |
| `DUPLICATE_COLLECTION_DOCUMENT` | Duplicado detectado por el validador cruzado; en el arranque normal el esquema ya lo rechaza |

Estos fallos bloquean `ready`. Los problemas de carga de los JSON también bloquean el arranque; véase [la tabla de configuración](configuration.md#carga-y-errores-que-impiden-iniciar).

El arranque no descarga Markdown ni comprueba que sus archivos existan. Una ruta segura que devuelve 404 puede pasar la configuración. Al solicitar ese documento, el proveedor distingue `HTTP_ERROR` o `NETWORK_ERROR` (también para CORS, redirecciones o lectura fallida); el ejecutor los presenta como `CONTENT_ERROR` recuperable. Se puede volver a ejecutar el comando sin reiniciar la terminal.

La caché es en memoria, por instancia de proveedor y sesión: conserva éxitos, comparte solicitudes del mismo ID y descarta fallos para permitir reintentos. `clear` no la borra. No hay persistencia entre sesiones.

## Fuente del contrato

[Esquema y tipos](../src/configuration/content.schema.ts), [reglas de IDs](../src/configuration/fields.ts), [validación cruzada](../src/configuration/validateConfiguration.ts), [rutas](../src/configuration/urls.ts) y [proveedor Markdown](../src/content/MarkdownContentProvider.ts). Pruebas: [esquema](../tests/configuration/content.schema.test.ts), [referencias](../tests/configuration/validateConfiguration.test.ts), [rutas](../tests/configuration/urls.test.ts) y [contenidos](../tests/content/MarkdownContentProvider.test.ts).
