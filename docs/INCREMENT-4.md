# Integración de la terminal React

La página de producción utiliza la configuración y los contenidos externos. No
contiene muestras estáticas ni importa Markdown como módulos de React.

## Composición y ciclo de vida

`main.tsx` monta App en StrictMode. `loadApplication` lee
`VITE_CONTENT_BASE_URL` y la opción de desarrollo de Vite. `bootstrapApplication`
reutiliza el bootstrap estricto de configuración y, después de validarlo todo,
`createCommandRuntime` crea un registro con comandos internos y personalizados,
el servicio real de contenidos y el ejecutor con `site.locale`.

El servicio compone ContentCatalog, MarkdownContentProvider y ContentCache una vez
por sesión. Las ejecuciones y los renders posteriores reutilizan esas instancias.
Los componentes no realizan HTTP ni duplican el parser. El Core y los contratos
JSON no se han modificado en esta integración.

`useConfiguration` mantiene loading, ready y error. Comparte la promesa del intento
durante la repetición de efectos de StrictMode, evitando descargar dos veces los
tres JSON. El botón de reintento inicia un intento nuevo. Cambiar la función de
carga retira la terminal anterior y reinicia la sesión; el cargador inyectado debe
mantener una identidad estable durante la sesión. Los resultados tardíos de
intentos descartados se ignoran. No se reutiliza una sesión antigua al volver a
un cargador anterior.

SitePage presenta nombre, descripción, bienvenida, colores y metadatos del sitio.
TerminalPrompt es el componente de entrada existente; se conecta a useTerminal,
que envía el texto al ejecutor y conserva por separado instrucciones y salida.
`clear` solo vacía la salida; conserva bienvenida, historial y caché. Los errores
de contenido permanecen recuperables dentro de la terminal.

## Reproducir con HTTP local

Desde la raíz, en dos terminales (pueden elegirse otros puertos libres):

```sh
FIXTURE_PORT=4186 pnpm run fixtures:serve
```

```sh
VITE_CONTENT_BASE_URL=http://127.0.0.1:4186/ pnpm run dev --host 127.0.0.1 --port 5186 --strictPort
```

Abrir `http://127.0.0.1:5186/`. Las fixtures de
`tests/fixtures/external-site` se sirven en otro origen con CORS; no se copian a
public ni dependen de GitHub Pages. La variable se pasa al proceso sin crear un
archivo `.env`. La aplicación de producción exige HTTPS; para probar HTTP local
debe utilizarse el servidor de desarrollo, no preview de un build de producción.

## Comprobación manual en navegador

Se ejecutaron las siguientes instrucciones mediante el campo real y Enter, con
Vite en StrictMode y las fixtures descargadas por HTTP local:

| Instrucción | Resultado observado |
| --- | --- |
| `help` | Ayuda de los tres comandos internos y cinco personalizados. |
| `help code` | Descripción y usos `code`, `code list`, `code <documento>`. |
| `clear` | Desaparece la salida; la bienvenida permanece. |
| `history` | Incluye help, help code, clear y la ejecución actual, en orden. |
| `about` | Presentación renderizada con negrita, acentos y emoji. |
| `contact` | Contacto y enlace de correo de la fixture. |
| `code` | Introducción del taller y sugerencia `code list`. |
| `code list` | Notas de TypeScript antes de React Hooks. |
| `code react-hooks` | Documento con bloque de código. |
| `read` | Introducción de biblioteca y sugerencia `read list`. |
| `read list` | cuento-002 antes de cuento-001. |
| `read cuento-001` | Texto de La puerta azul. |
| `inexistente` | Error comprensible de comando desconocido. |
| `code inexistente` | Error de pertenencia, conforme al contrato del ejecutor. |
| `missing` | Error recuperable por el archivo ausente (404). |
| `about` después del error | La misma terminal sigue operativa y muestra el documento. |

Un ID inexistente solicitado dentro de una colección usa el error de pertenencia
existente. Una referencia inexistente en commands.json impediría el arranque;
no se ha debilitado esa validación para fabricar una sesión inválida.

## Pruebas automatizadas y correcciones

`tests/app/App.http.test.tsx` conecta App en StrictMode, el adaptador de Vite,
bootstrap, registro, ejecutor y contenidos sobre un servidor HTTP real en un
puerto efímero. Repite el recorrido en español e inglés. Verifica los tres JSON
una sola vez, Markdown bajo demanda, orden de listados, alias, argumentos
incorrectos, IDs ausentes o ajenos, clear e historial original. Publica un archivo
en una copia temporal tras su 404 y comprueba que el siguiente intento funciona;
también verifica que clear y un alias conservan la caché por ID. Las copias se
eliminan al terminar y las fixtures del repositorio no se modifican.

`tests/app/App.test.tsx` añade cobertura de cargas obsoletas (éxito y fallo),
cambio de sesión durante un comando pendiente y retorno a un cargador anterior.
Conserva las pruebas de carga, error, reintento, colores, idioma y metadatos.

Se corrigieron dos puntos del ciclo de vida: el arranque duplicado en StrictMode
y la presentación de una sesión anterior al cambiar el cargador. La utilidad de
fixtures resuelve ahora su directorio mediante `import.meta.dirname`, evitando
que Vite transforme `new URL(..., import.meta.url)` en una URL web bajo jsdom.

Comprobaciones finales:

- `pnpm run test`: 520 pruebas aprobadas en 24 archivos.
- `pnpm run typecheck`: correcto.
- `pnpm run typecheck:core`: correcto, sin bibliotecas DOM ni React en el Core.
- `pnpm run build`: correcto.
- `git diff --check`: correcto.

## Limitaciones

- El recorrido manual se realizó en el navegador integrado en español; inglés
  también se verifica mediante las pruebas de integración, sin una segunda pasada
  manual completa. No se ha realizado una auditoría con lector de pantalla ni una
  matriz de navegadores/dispositivos.
- Se ignoran respuestas obsoletas, pero no se cancelan las solicitudes HTTP que
  ya estaban en curso. No hay reintentos automáticos ni persistencia entre sesiones.
- VITE_CONTENT_BASE_URL se configura en el proceso de Vite/build; no existe un
  selector de sitio en tiempo de ejecución. Cambiar el entorno requiere reiniciar
  Vite o reconstruir el sitio publicado.
- Los servidores remotos deben permitir acceso público y CORS cuando corresponda.
  Markdown conserva las restricciones de seguridad y las capacidades ya aprobadas.

No se añadieron dependencias ni se realizó commit.
