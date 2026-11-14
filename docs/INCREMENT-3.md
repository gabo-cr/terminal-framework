# Verificación final del Incremento 3

El recorrido verificado es: variable de Vite → carga HTTP de los tres JSON →
esquemas y validación cruzada → catálogo, proveedor y caché → registro y ejecutor →
resultados estructurados. Se utiliza Fetch real contra loopback, sin simular las
respuestas del servidor ni importar Markdown en el Core.

## Fixtures externas

`tests/fixtures/external-site` representa un sitio ficticio independiente de la aplicación.
Contiene tres JSON versión 1 y ocho documentos Markdown: presentación, contacto,
introducciones del taller y la biblioteca, dos apuntes técnicos y dos cuentos.
Los listados tienen un orden deliberadamente distinto del alfabético.

El catálogo incluye además `remote-missing`, cuyo archivo no se distribuye. Su
referencia es válida, pero la descarga produce un 404 real. El comando `missing`
sirve exclusivamente para probar ese error recuperable. No se alteran contratos
JSON. El ejemplo mínimo de UI se conserva en `tests/fixtures/ui-site` con un nombre genérico.

## Reproducción local

Con las dependencias instaladas, en una terminal:

```sh
pnpm run fixtures:serve
```

El servidor escucha únicamente en `127.0.0.1:4174`, habilita CORS público, responde
404 para archivos inexistentes y no aplica fallback de SPA. `FIXTURE_PORT` permite
cambiar el puerto. No requiere GitHub Pages, Python ni dependencias adicionales.
El comando utiliza la eliminación de tipos nativa de Node; Node 22 puede mostrar
un aviso de función experimental.

En otra terminal, para comprobar la presentación existente:

```sh
VITE_CONTENT_BASE_URL=http://127.0.0.1:4174/ pnpm run dev
```

La UI muestra el nombre, descripción y bienvenida de estas fixtures. Todavía no
acepta instrucciones. El adaptador `src/app/loadApplication.ts` utiliza la misma
variable de Vite para preparar el motor completo sin depender de React.

Para ejecutar todos los casos del motor sobre HTTP real:

```sh
pnpm run test:contents:http
```

Este comando inicia y cierra su propio servidor con puerto efímero, copia las
fixtures a un directorio temporal y configura `VITE_CONTENT_BASE_URL` durante la
prueba. No necesita el servidor manual. Requiere permiso para abrir un socket de
loopback; en entornos aislados este permiso puede necesitar habilitarse.

## Casos verificados

| Caso | Comprobación |
| --- | --- |
| `about`, `contact` | Texto exacto del archivo Markdown servido, incluidos Unicode y saltos de línea. |
| `code`, `read` | Introducción real y sugerencia canónica `comando list`. |
| `code list` | `typescript-notes`, `react-hooks`, sin descargar cuerpos Markdown. |
| `read list` | `cuento-002`, `cuento-001`, en el orden completo configurado. |
| `code react-hooks`, `read cuento-001` | Documento correcto descargado por ID global. |
| Documento ajeno | Error de pertenencia antes de hacer HTTP. |
| `missing` | Error `CONTENT_ERROR` con causa `HTTP_ERROR` y estado 404. |
| Reintento tras 404 | El test publica el archivo en la copia temporal; el mismo servicio lo descarga correctamente y luego lo cachea. |
| Consulta repetida o alias | El servidor recibe una única solicitud del documento. |
| `help`, `clear`, `history` | Resultados aprobados; clear conserva caché e historial; history incluye la ejecución actual. |
| Variable de Vite | `loadConfiguration` y `loadApplication` resuelven la misma raíz HTTP y los tres JSON correctos. |

Las pruebas existentes con Fetch simulado se conservan: cubren además errores 500,
red, concurrencia, limpieza de caché y mensajes internos en español e inglés.

## Revisión arquitectónica

- Los imports de producción del Core en tiempo de ejecución apuntan únicamente a
  otros módulos del Core. No hay imports de React, Fetch o fixtures.
- `ContentCatalog` consulta mapas y conjuntos; no hace HTTP.
- `MarkdownContentProvider` depende del catálogo y la resolución segura de URLs;
  no importa el parser, registro ni ejecutor.
- `ContentCache` depende solo del tipo de servicio y promesas; no conoce UI,
  comandos, almacenamiento persistente ni transporte HTTP.
- Se conservaron los esquemas y contratos JSON y la unión de resultados.
- Las fixtures ficticias están fuera de `src/core`; no hay referencias al sitio
  personal ni URLs de producción hardcodeadas en el motor o los contenidos.
- El ejecutor recibe un servicio compuesto creado una sola vez por arranque. La
  integración sigue separada de la UI.

## Resultados de verificación

- `pnpm run test:contents:http`: 13 pruebas HTTP aprobadas.
- `pnpm run test`: 467 pruebas aprobadas en 19 archivos, incluidas las de HTTP real.
- `pnpm run typecheck`: correcto; incluye el test HTTP y el servidor.
- `pnpm run typecheck:core`: correcto, sin tipos DOM ni Vite.
- `pnpm run build`: correcto.
- `pnpm run fixtures:serve`: inicio manual comprobado y servidor detenido al terminar.
- `git diff --check`: sin errores.

No se detectaron defectos nuevos del motor ni fue necesario modificar los
contratos o el código de producción de Core/content. Se añadió el adaptador de
Vite del arranque completo para verificar la variable con ambos puntos de entrada.

## Límites pendientes

HTTP sin TLS se limita al desarrollo local; producción requiere HTTPS y CORS del
servidor remoto. Las pruebas de Node comprueban solicitudes reales,
pero no sustituyen una comprobación futura de CORS en navegador. Las fixtures
externas no se incluyen en el build de la aplicación. El archivo ausente es
intencional y no debe añadirse al repositorio como solución al caso 404.

El renderizado seguro de Markdown, la interfaz interactiva y la coordinación del
historial desde esa UI quedan para incrementos posteriores. No se añaden aquí
cancelación, expiración, persistencia ni límites de tamaño de caché.
