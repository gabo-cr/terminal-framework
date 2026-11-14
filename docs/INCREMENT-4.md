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

- `pnpm run test`: 521 pruebas aprobadas en 24 archivos tras la revisión final.
- `pnpm run typecheck`: correcto.
- `pnpm run typecheck:core`: correcto, sin bibliotecas DOM ni React en el Core.
- `pnpm run build`: correcto.
- `git diff --check`: correcto.

## Revisión final del Incremento 4

Revisión realizada el 14 de noviembre de 2026 sobre los cambios desde el cierre
del Incremento 3 (`f186e52`) hasta la integración (`ce9fd4f`), más la corrección
descrita aquí. El árbol de trabajo estaba limpio al comenzar.

### Fallo encontrado y corregido

**P2 — pérdida de la posición de lectura al redimensionar.** Con `code react-hooks`
y un documento largo, llegar al final con Ctrl+End y pasar de un viewport móvil
de 375 × 812 a 390 × 844 hacía saltar la salida al principio. ResizeObserver
ejecutaba de nuevo el seguimiento del último resultado aunque no hubiera una
ejecución nueva. Antes de corregirlo, la posición pasó de aproximadamente 1601 px
a 52 px. Tras retirar ese observador, el navegador mantiene el anclaje al final
(aproximadamente 1471 px con la nueva altura del documento).

El seguimiento sigue ejecutándose ante cambios de resultados y bienvenida,
respetando si el visitante lee contenido anterior. Se conserva el desplazamiento
local y la preferencia de movimiento reducido. Una prueba de regresión simula
redimensionado sin nuevos resultados y comprueba que no se ordena volver al inicio.
El caso se reprodujo antes y después en el navegador con el código actualizado.

### Matriz de verificación

| Área | Evidencia y resultado |
| --- | --- |
| Enter y entrada vacía | Navegador: una entrada de espacios no crea ejecución; Enter ejecuta y limpia el campo. Pruebas: IME, repetición y bloqueo mientras hay una promesa pendiente. |
| Internos y contenidos | Recorrido real de help, help code, clear, history, about, contact, code, code list, code react-hooks, read, read list y read cuento-001. Introducciones, sugerencias y orden correctos. |
| Errores | Comando desconocido, 404 y caída del servidor de fixtures muestran errores recuperables. Al restablecer HTTP, about funciona en la misma sesión. |
| Historial y borrador | Navegador: clear conserva las instrucciones y la bienvenida; arriba recupera el comando, abajo devuelve «mi borrador». Pruebas adicionales conservan alias y espacios originales. |
| Foco y teclado | El campo mantiene el foco después de ejecutar. Tab/Shift+Tab alcanzan enlaces, bloques de código y entrada; la flecha derecha desplaza el código dentro de su bloque. Pruebas verifican no quitar el foco a un enlace durante una espera. |
| Diseño adaptable | Inspección real en viewports 1280 × 900, 375 × 812 y 390 × 844. Sin desbordamiento horizontal de página; títulos y palabras largas se ajustan. Esto prueba tamaños de ventana, no un teléfono físico. |
| Markdown | Encabezados, énfasis, listas, citas, separador, enlace, código y Unicode renderizados. En móvil, la línea ancha conserva unos 1887 px de contenido dentro de un bloque de unos 262–277 px, sin ensanchar la página. |
| Seguridad de enlaces | En navegador, el enlace HTTPS tiene target=_blank y rel=noopener noreferrer; javascript: aparece como texto sin enlace. Pruebas cubren esquemas peligrosos, HTML crudo y ausencia de imágenes remotas. |
| Anuncios accesibles | Etiqueta del campo, aria-busy y role=status comprobados en componentes; historial sin aria-live para evitar repetir documentos. Errores con role=alert. No se verificó la locución con un lector de pantalla. |
| Scroll | El panel conserva la posición al leer una salida anterior; sigue resultados cuando está al final. Corrección de redimensionado comprobada. No se llama a scrollIntoView ni se ordena scroll global; enfocar elementos fuera de la ventana puede causar el ajuste nativo del navegador. |

La fixture `react-hooks.md` se amplió con casos de texto largo, código y enlaces;
es utilizada por las pruebas HTTP existentes y permite reproducir la revisión
visual sin modificar JSON ni añadir comandos de producción.

### Contraste y arquitectura

Con los colores predeterminados, los valores calculados a partir de los estilos
del navegador son 8,51:1 para el acento sobre el panel, 11,04:1 para los resultados
y 5,32:1 para el texto secundario. El contorno del campo usa el acento y es visible;
los bloques de código también tienen contorno al enfocarlos con teclado.
Estos valores no garantizan contraste para cualquier tema personalizado.

La revisión de imports y diferencias confirma:

- Core no importa React ni hace HTTP; `typecheck:core` pasa con su configuración aislada.
- Terminal no usa fetch ni proveedores; consume tipos y el ejecutor inyectado.
- MarkdownContentProvider no importa ni interpreta comandos.
- Los contratos JSON, Core, Configuration y Content no cambiaron en el Incremento 4.
- VITE_CONTENT_BASE_URL sigue gobernando la carga externa; los Markdown llegan
  por HTTP y no se importan como módulos de React.
- No hay datos personales hardcodeados ni nuevas dependencias en esta revisión.
  react-markdown es la única dependencia de ejecución añadida durante el incremento,
  conforme al alcance aprobado; no hay xterm, plugins de Markdown ni persistencia.

Archivos de esta revisión: `src/terminal/useTerminalScroll.ts`,
`tests/terminal/accessibility.test.tsx`, la fixture `documents/react-hooks.md` y
su README, `docs/PROJECT.md` y este informe. Se conservaron todas las fixtures.

## Limitaciones

- El recorrido real se realizó en el navegador integrado en español; inglés
  se verifica mediante integración automatizada. Quedan pendientes lectores de
  pantalla, teclado virtual/táctil en teléfonos físicos y otros motores de navegador.
- Los colores personalizados son libres conforme al contrato aprobado: el autor
  del sitio debe revisar su contraste. No se añadió un cambio de esquema ni una
  transformación automática de colores.
- Se ignoran respuestas obsoletas, pero no se cancelan las solicitudes HTTP que
  ya estaban en curso. No hay reintentos automáticos ni persistencia entre sesiones.
- VITE_CONTENT_BASE_URL se configura en el proceso de Vite/build; no existe un
  selector de sitio en tiempo de ejecución. Cambiar el entorno requiere reiniciar
  Vite o reconstruir el sitio publicado.
- Los servidores remotos deben permitir acceso público y CORS cuando corresponda.
  Markdown conserva las restricciones de seguridad y las capacidades ya aprobadas.

No se añadieron dependencias ni se realizó commit.
