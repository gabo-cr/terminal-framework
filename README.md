# terminal-framework

Framework open source en desarrollo para crear sitios personales cuya interfaz principal es una terminal. Quien visita el sitio escribe comandos sencillos para descubrir textos, proyectos y otras publicaciones.

## Visión y filosofía

Un sitio personal puede ser un espacio para reunir lo que haces, escribes y piensas. `terminal-framework` propone explorarlo mediante una conversación breve con una terminal: escribir `help`, elegir un contenido y leerlo a tu ritmo.

La intención es mantener una experiencia sencilla y dar protagonismo al contenido. No necesitas conocer una terminal de sistema para visitar el sitio: `help` muestra las opciones disponibles y cómo usarlas.

Cada persona define su nombre, presentación, colores, comandos y publicaciones en archivos separados. Así, el framework puede servir a sitios distintos sin incorporar la identidad ni los textos de una persona en su código.

## Qué puedes hacer hoy

- Explorar documentos y colecciones mediante comandos, con nombres alternativos opcionales.
- Consultar ayuda con `help`, ver comandos anteriores con `history` y recuperar instrucciones con ↑/↓.
- Completar comandos, alias y recursos con Tab, elegir coincidencias por teclado o clic y recibir alternativas ante errores tipográficos.
- Leer textos Markdown con títulos, listas, enlaces y bloques de código dentro de la terminal.
- Limpiar las respuestas sin perder la bienvenida ni el historial de comandos de la sesión.
- Personalizar la presentación y elegir español o inglés para los mensajes del sistema. Los textos publicados conservan el idioma en que se escribieron.
- Usar una interfaz adaptable a pantallas pequeñas y grandes, con desplazamiento dentro del panel.
- Cargar la configuración desde una ubicación pública y descargar cada documento cuando se solicita. Los documentos recuperados se conservan en memoria durante la sesión.

Antes de abrir la terminal, la aplicación comprueba los tres archivos de configuración y las referencias entre ellos. Si algo falla, muestra un error y permite reintentar. La existencia de los archivos Markdown se comprueba al pedirlos; un fallo de descarga se muestra sin cerrar la sesión.

## Demostración visual

**Pendiente:** incorporar una captura real o una grabación breve de la terminal en uso y, cuando esté disponible, un enlace a una demostración pública.

Mientras tanto, puedes probar el sitio ficticio incluido en el repositorio siguiendo los pasos de instalación. Sus textos son material de prueba, no contenido personal de producción.

## Tecnologías

La interfaz usa **React y TypeScript**, con **Vite** para el entorno de desarrollo y la generación del sitio, y **Tailwind CSS** para los estilos. **Zod** comprueba la configuración, **react-markdown** presenta los documentos y **Vitest**, junto con Testing Library, permite verificar el comportamiento.

El resultado es un sitio estático: los archivos generados pueden publicarse sin ejecutar un servidor propio de la aplicación. Los contenidos deben estar disponibles desde un servidor de archivos públicos.

## Requisitos

Para ejecutar el proyecto en tu equipo necesitas:

- Node.js **22 desde 22.12**, **24.x** o **26 en adelante**, según las versiones admitidas en `package.json`.
- **pnpm 12.6.0**, la versión fijada por el proyecto.
- Una copia de este repositorio y un navegador actual.
- Acceso a los archivos de contenido: puedes empezar con el sitio de prueba incluido.

Los comandos siguientes se ejecutan desde la carpeta del repositorio, en una terminal de tu equipo.

## Instalación y primera prueba

Instala las dependencias respetando las versiones del archivo de bloqueo:

```sh
pnpm install --frozen-lockfile
```

Copia `.env.example` a `.env.local`. Para probar el contenido incluido, sustituye el valor de `VITE_CONTENT_BASE_URL` en esa copia por:

```dotenv
VITE_CONTENT_BASE_URL=http://127.0.0.1:4174/
VITE_BASE_PATH=/terminal-framework/
```

Inicia el servidor del sitio de prueba:

```sh
pnpm run fixtures:serve
```

Déjalo abierto y, en otra terminal situada en la misma carpeta, inicia la aplicación:

```sh
pnpm run dev
```

Abre la dirección que indique Vite, con la ruta `/terminal-framework/`, y escribe `help` en la terminal del sitio.

El sitio de prueba está en `tests/fixtures/external-site`. Incluye un documento ausente de forma intencional para comprobar cómo se presenta un error de descarga. Puedes consultar sus detalles en [la guía del sitio de prueba](tests/fixtures/external-site/readme.md).

## Conectar tus propios contenidos

`VITE_CONTENT_BASE_URL` indica la carpeta pública desde la que se cargan tanto la configuración como los documentos. Para usar tus contenidos, cambia el valor de `.env.local` por su raíz pública real, terminada en `/`.

Esa ubicación debe ofrecer esta estructura:

```text
<raíz de contenidos>/
├── config/
│   ├── site.json
│   ├── commands.json
│   └── content.json
└── documents/
    └── … archivos Markdown
```

La carpeta `config/` y los nombres de los tres JSON son obligatorios. `documents/` es una forma de organizar los textos; sus rutas concretas se declaran en `content.json`.

La raíz debe usar **HTTPS**. HTTP solo se admite durante el desarrollo en `localhost`, `127.0.0.1` o `[::1]`. Los archivos deben poder leerse sin iniciar sesión y sin redirecciones. Si están alojados en un origen distinto al de la aplicación, su servidor debe permitir esa lectura mediante CORS.

Esta variable es pública y queda incorporada al generar el sitio; no debe contener secretos. Reinicia el servidor de desarrollo después de cambiarla. Para cambiar la raíz de un sitio ya generado, debes generar y publicar de nuevo la aplicación.

### Los tres archivos JSON

JSON es un formato de texto que permite describir datos de manera estructurada. Aquí cada archivo tiene una tarea:

| Archivo | Qué define |
| --- | --- |
| `site.json` | El nombre y la descripción del sitio, el idioma de sus mensajes, la bienvenida y los colores. |
| `commands.json` | Los comandos propios del sitio: su nombre, descripción, alias opcionales y el documento o colección que abren. |
| `content.json` | El catálogo de documentos y colecciones: identificadores, títulos, rutas de los Markdown y el orden de los documentos de cada colección. |

Los tres requieren `version: 1`. Una colección reúne una introducción y una lista ordenada de documentos. Los textos se escriben en archivos Markdown independientes y se conectan al catálogo por sus identificadores.

Puedes revisar [los JSON del sitio de prueba](tests/fixtures/external-site/config) para ver ejemplos completos y [los contratos de configuración](docs/configuration.md) para conocer los campos y reglas exactos.

## Comandos de la terminal

Estos comandos se escriben dentro del sitio, no en la terminal de tu equipo:

| Comando | Qué hace |
| --- | --- |
| `help` | Muestra todos los comandos disponibles y su uso. |
| `help <comando>` | Explica un comando concreto. |
| `clear` | Limpia las respuestas visibles; conserva la bienvenida y el historial. |
| `history` | Muestra los comandos enviados durante la sesión. |

Los nombres entre `< >` se sustituyen por un valor real, sin escribir esos signos.

Cada sitio añade sus propios comandos mediante `commands.json`. Un comando de documento abre directamente su texto; uno de colección admite estas formas:

| Forma | Qué muestra |
| --- | --- |
| `<comando>` | La introducción de la colección. |
| `<comando> list` | Los documentos disponibles en esa colección. |
| `<comando> <documento>` | Un documento de la colección, elegido por su identificador. |

Los nombres y los identificadores distinguen mayúsculas y minúsculas. La sintaxis admite un comando y, como máximo, un argumento. No ejecuta instrucciones del sistema operativo.

Usa **Tab** al final de la entrada para completar comandos o recursos. Si aparecen varias opciones, elige con **↑ / ↓** y confirma con **Tab** o clic. **Escape** cierra la lista. **Enter** siempre envía el texto que hayas escrito, sin elegir automáticamente una sugerencia. Si la única opción ya coincide con la entrada, Tab permite salir del campo. Con la lista cerrada, **↑ / ↓** recorren el historial y conservan tu borrador. El historial y la memoria de documentos pertenecen a la sesión; no se guardan entre recargas.

## El framework y tus publicaciones

Este repositorio contiene la aplicación, sus pruebas y su documentación. La configuración y los contenidos de cada sitio se alojan por separado, en una raíz pública elegida por su propietario.

Para cambiar textos o añadir documentos y comandos dentro de los formatos admitidos, modifica esos archivos externos. No necesitas editar el código del framework. Una nueva sesión recupera la configuración y los contenidos; durante una sesión, un documento ya leído puede seguir saliendo de la memoria local.

Las muestras de `tests/fixtures/` sirven para desarrollo y pruebas y no se incluyen en el sitio generado.

## Pruebas y generación del sitio

Para comprobar los tipos y ejecutar las pruebas automatizadas:

```sh
pnpm run typecheck
pnpm run typecheck:core
pnpm run test
```

Las pruebas están en `tests/`. Algunas abren servidores locales temporales, por lo que el entorno debe permitir escuchar en puertos locales. No necesitan que el servidor manual de contenidos esté activo.

Para generar los archivos publicables:

```sh
pnpm run build
```

Se crean en `dist/`. Puedes revisar el resultado localmente con:

```sh
pnpm run preview
```

La ruta de publicación predeterminada es `/terminal-framework/`. Para publicar desde la raíz de un dominio, configura `VITE_BASE_PATH=/` antes de generar el sitio.

**La prueba con contenidos HTTP locales funciona en desarrollo.** Para comprobar el sitio generado con `preview`, utiliza una raíz de contenidos HTTPS: la excepción de HTTP local no está habilitada en ese modo.

El repositorio incluye un workflow manual para GitHub Pages. Preparar el build o iniciar una vista previa no publica el sitio. Los pasos de publicación están en [la guía de despliegue](docs/deployment.md).

## Documentación detallada

- [Instalación y desarrollo local](docs/development.md).
- [Configuración del sitio: site.json](docs/configuration.md).
- [Comandos: commands.json](docs/commands.md).
- [Catálogo de contenidos: content.json](docs/content.md).
- [Visión, arquitectura y configuración](docs/project.md).
- [Motor de comandos y contrato de integración](docs/core.md).
- [Publicación en GitHub Pages y dominio personalizado](docs/deployment.md).
- [Sitio externo de prueba](tests/fixtures/external-site/readme.md).

## Uso del código y forks

Este es un proyecto de mantenimiento personal: **no se aceptan ni se revisan contribuciones externas o pull requests**. Puedes descargar, clonar o hacer un fork del código para adaptarlo y mantener tu propia versión, sin obligación de aportar tus cambios al repositorio original.

Consulta [la política de uso y contribuciones](CONTRIBUTING.md). El framework se distribuye bajo la [licencia MIT](LICENSE), con copyright de Gabriel Chávez Riera (2026). La licencia de los contenidos personales es independiente.

## Estado y limitaciones

El código incluye el autocompletado y las sugerencias en la versión v0.2.0, actualizada en `package.json`. Consulta [CHANGELOG.md](CHANGELOG.md) para el registro de versiones.

Quedan por completar la demostración visual y una versión en inglés de este README. También están pendientes las comprobaciones con lectores de pantalla y dispositivos móviles físicos señaladas en la documentación, y la verificación remota del despliegue con los contenidos reales.

Flags, búsqueda, categorías y plugins no forman parte de las capacidades actuales.

Este README se mantiene por ahora en español, con secciones independientes para facilitar una futura versión equivalente en inglés.
