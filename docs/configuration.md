# Configuración del sitio: site.json

El archivo `config/site.json`, bajo la raíz `VITE_CONTENT_BASE_URL`, define la presentación del sitio. Se carga junto con [commands.json](commands.md) y [content.json](content.md).

## Campos y valores predeterminados

| Campo | Tipo admitido | Obligatorio | Si se omite |
| --- | --- | --- | --- |
| `version` | Número literal `1` | Sí | Error |
| `name` | Cadena con texto no vacío | Sí | Error |
| `description` | Cadena con texto no vacío | Sí | Error |
| `locale` | Cadena `es` o `en` | No | `es` |
| `terminal` | Objeto | No | Se completan sus propiedades |
| `terminal.welcome` | Cadena, incluso vacía | No | Bienvenida según idioma |
| `theme` | Objeto | No | Se completan sus propiedades |
| `theme.accentColor` | Color hexadecimal `#RRGGBB` | No | `#96D9A5` |
| `theme.terminalBackground` | Color hexadecimal `#RRGGBB` | No | `#292C32` |

Todos los objetos son estrictos: rechazan propiedades desconocidas, también dentro de `terminal` y `theme`. Ningún campo admite `null`. `version: "1"` no equivale a `version: 1`. Las cadenas obligatorias rechazan valores vacíos o solo con espacios, pero conservan los espacios de un texto válido: no se recortan ni normalizan.

Los colores admiten seis dígitos hexadecimales, con letras mayúsculas o minúsculas y `#` inicial. No admiten nombres de colores, formato corto ni canal alfa. El fondo se aplica al panel; el acento se usa en enlaces y para derivar los tonos de comandos y ayuda.

`name` y `description` se muestran en la página y actualizan el título HTML y la descripción del documento. `locale` actualiza el idioma del documento y los mensajes internos; no traduce los contenidos ni las descripciones personalizadas.

### Bienvenida

Si no se proporciona `terminal.welcome`, se utiliza exactamente:

- `es`: «Bienvenido. Escribe help para explorar el sitio.»
- `en`: «Welcome. Type help to explore the site.»

Omitir `terminal` o indicar `{}` produce la misma bienvenida predeterminada. Una cadena explícita `""` se conserva: no se reemplaza. La bienvenida se presenta como texto, no como Markdown. `theme` también admite `{}` o un objeto parcial y completa cada color omitido.

## Ejemplo mínimo válido

```json
{
  "version": 1,
  "name": "Cuaderno abierto",
  "description": "Textos y proyectos para explorar."
}
```

## Ejemplo completo

```json
{
  "version": 1,
  "name": "Cuaderno abierto",
  "description": "Textos y proyectos para explorar.",
  "locale": "es",
  "terminal": {
    "welcome": "Hola. Escribe help para comenzar."
  },
  "theme": {
    "accentColor": "#96D9A5",
    "terminalBackground": "#292C32"
  }
}
```

Los dos ejemplos pueden combinarse con los ejemplos de las otras guías. Los tipos `SiteConfigInput` y `SiteConfig`, derivados de Zod, distinguen la entrada del resultado con valores predeterminados aplicados.

## Carga y errores que impiden iniciar

La raíz debe ser una URL HTTPS absoluta. HTTP solo se permite en desarrollo con `localhost`, `127.0.0.1` o `[::1]`. La raíz se normaliza con barra final; no admite credenciales, consulta, fragmento ni segmentos ambiguos. Las solicitudes omiten credenciales y rechazan redirecciones. El servidor debe permitir CORS cuando corresponda.

El sitio solo alcanza `ready` después de cargar y validar los tres JSON y sus referencias. No hay arranque parcial.

| Código de configuración | Motivo |
| --- | --- |
| `INVALID_BASE_URL` | Raíz ausente o no permitida |
| `UNSAFE_PATH` | Ruta de carga no permitida |
| `NETWORK_ERROR` | Fallo de descarga o lectura, incluido bloqueo de CORS o redirección |
| `HTTP_ERROR` | Respuesta HTTP no exitosa para un JSON |
| `INVALID_JSON` | El cuerpo no se puede interpretar como JSON |
| `SCHEMA_VALIDATION_ERROR` | Campos, tipos, valores o propiedades no admitidos |
| `CROSS_VALIDATION_ERROR` | Conflictos, referencias o rutas de documentos inválidas |

Un idioma no admitido, un color inválido o una propiedad desconocida bloquean el inicio; no se sustituyen silenciosamente por valores predeterminados. La interfaz permite reintentar el arranque tras corregir el problema. Las descargas Markdown no forman parte de esta validación inicial: sus fallos son [errores recuperables de ejecución](commands.md#errores-durante-una-ejecución).

## Fuente del contrato

Esquema y tipos: [site.schema.ts](../src/configuration/site.schema.ts). Carga: [ConfigurationLoader.ts](../src/configuration/ConfigurationLoader.ts). Coherencia: [validateConfiguration.ts](../src/configuration/validateConfiguration.ts). Pruebas: [site.schema.test.ts](../tests/configuration/site.schema.test.ts) y [bootstrap.test.ts](../tests/app/bootstrap.test.ts).
