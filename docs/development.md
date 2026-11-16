# Desarrollo local

Esta guía permite ejecutar el framework con contenidos de prueba o con una raíz pública propia. Para publicarlo, consulta [despliegue](deployment.md).

## Requisitos y versiones

`package.json` declara Node.js `^22.12.0 || ^24.0.0 || >=26.0.0`: rama 22 desde 22.12, rama 24 o versiones desde 26. La versión oficial del gestor es **pnpm 12.6.0**, fijada en `packageManager` y en el lockfile. El workflow utiliza Node 24.

Comprueba tu entorno:

```sh
node --version
pnpm --version
```

Desde la carpeta del repositorio, instala con:

```sh
pnpm install --frozen-lockfile
```

Conserva `pnpm-lock.yaml` como único lockfile. La opción congelada impide que la instalación cambie la resolución de dependencias: si informa que el manifiesto y el lockfile no coinciden, comprueba que pertenecen a la misma revisión y que estás usando la versión fijada de pnpm. No borres el lockfile para ocultar el problema.

## Preparar .env.local

Copia `.env.example` a `.env.local`. Este archivo local está excluido de Git. Para comenzar con las muestras incluidas, usa:

```dotenv
VITE_CONTENT_BASE_URL=http://127.0.0.1:4174/
VITE_BASE_PATH=/terminal-framework/
```

`VITE_CONTENT_BASE_URL` es la raíz que contiene `config/site.json`, `config/commands.json`, `config/content.json` y las rutas Markdown del catálogo. Para contenidos propios, sustituye el valor por su raíz HTTPS pública real. No es una URL a un JSON concreto ni una ruta de tu disco.

HTTP se permite únicamente en desarrollo con `localhost`, `127.0.0.1` o `[::1]`. La raíz no admite credenciales, consultas, fragmentos ni segmentos ambiguos. Las solicitudes rechazan redirecciones y omiten credenciales; un servidor de otro origen debe permitir CORS. Véanse los [contratos de configuración](configuration.md).

`VITE_BASE_PATH` controla la ruta de la aplicación, no la de sus contenidos. Si se omite o está vacía, Vite utiliza `/terminal-framework/`. Reinicia Vite tras cambiar variables. Las variables `VITE_` son públicas y se incorporan al build: no incluyas secretos.

## Iniciar con el sitio de prueba

En una terminal, inicia el servidor de fixtures:

```sh
pnpm run fixtures:serve
```

Sirve `tests/fixtures/external-site` en `http://127.0.0.1:4174/`, con CORS habilitado. Déjalo abierto y, en otra terminal desde el repositorio, ejecuta:

```sh
pnpm dev
```

Abre la dirección indicada por Vite con la ruta `/terminal-framework/` y escribe `help`. Puedes probar `code list` y `code react-hooks` con el catálogo de prueba. Hay un Markdown ausente intencionalmente para comprobar errores; consulta [las fixtures](../tests/fixtures/external-site/readme.md).

Si utilizas contenidos externos públicos, no necesitas el servidor de fixtures. Las muestras se mantienen en `tests/`, no se publican dentro de `dist/`.

## Comprobar cambios

```sh
pnpm run typecheck
pnpm run typecheck:core
pnpm run test
```

Vitest ejecuta las pruebas una vez. Para una selección concreta:

```sh
pnpm exec vitest run tests/configuration
pnpm run test:contents:http
```

Las pruebas HTTP abren servidores locales temporales: no requieren el servidor manual y necesitan permiso del entorno para escuchar en puertos locales.

## Generar y revisar el sitio

```sh
pnpm run build
pnpm run preview
```

`build` comprueba tipos y genera `dist/`; `preview` sirve ese resultado sin publicarlo. La URL debe corresponder a `VITE_BASE_PATH`.

Para comprobar la base raíz, cambia `VITE_BASE_PATH=/` en `.env.local` y vuelve a generar. **Preview requiere contenidos HTTPS**: la excepción de HTTP local no se activa en producción. Un build correcto no demuestra que el servidor real de contenidos esté disponible ni que sus JSON sean válidos; esas comprobaciones ocurren al abrir la aplicación.

## Problemas locales frecuentes

| Síntoma | Qué revisar |
| --- | --- |
| No se encuentra pnpm o la versión difiere | Instala o activa pnpm 12.6.0 en tu entorno antes de instalar dependencias |
| No carga la configuración | Servidor de fixtures activo, raíz correcta y tres JSON disponibles; revisa Network en el navegador |
| Cambios de variables sin efecto | Reinicia Vite; revisa también `.env` y variables exportadas por tu terminal |
| El puerto 4174 está ocupado | Detén el proceso que lo ocupa o configura `FIXTURE_PORT` en el entorno y actualiza la raíz local |
| `listen EPERM` en pruebas | El entorno bloquea servidores locales; ejecuta las pruebas HTTP donde se permitan puertos locales |
| Funciona en dev, falla en preview | Sustituye HTTP local por una raíz HTTPS válida y vuelve a generar |

## Reproducir la verificación integrada del MVP

Con Vite y el servidor de fixtures activos, prueba en `/terminal-framework/`:

1. `help` y `help code`: comandos y usos en una columna, descripción en otra.
2. `about`, `code`, `code list`, `code react-hooks`, `read list` y `read cuento-001`: Markdown, introducciones y listados completos en el orden configurado.
3. `unknown`, `code nonexistent`, `about extra` y `missing`: errores recuperables, sin perder la sesión. El archivo de missing no existe a propósito.
4. `clear` y `history`: la salida se limpia sin borrar bienvenida, comandos ni caché. Usa ↑/↓ para recuperar instrucciones y volver al borrador.
5. Tab/Shift+Tab: salir del input, enfocar enlaces, bloques de código y región de historial, y volver sin que la terminal robe el foco. El campo tiene foco inicial y lo conserva al ejecutar si no te trasladas a otro elemento.
6. Leer un documento largo, desplazarse a una respuesta anterior y redimensionar: conservar la posición de lectura. Revisar tamaños de escritorio y móvil sin desbordamiento global.

`tests/app/App.http.test.tsx` reproduce el recorrido con React, bootstrap, motor y HTTP real en español e inglés. `tests/app/contents.http.test.ts` comprueba además descarga, caché y recuperación tras publicar el archivo ausente en una copia temporal. `tests/terminal/accessibility.test.tsx` verifica la conservación de foco en otros controles y decisiones de scroll con geometría simulada; jsdom no sustituye pruebas de teclado en un navegador.

### Probar otra configuración

Las muestras `ui-site` y `external-site` representan catálogos ficticios distintos. El servidor manual usa external-site. Para servir ui-site temporalmente en otro puerto desde una terminal:

```sh
pnpm exec node --experimental-strip-types --input-type=module -e "import('./tests/support/serve-fixtures.ts').then(({ createFixtureServer }) => createFixtureServer('./tests/fixtures/ui-site').listen(4175, '127.0.0.1'))"
```

Este comando usa la eliminación de tipos de Node. Cambia temporalmente `VITE_CONTENT_BASE_URL` de `.env.local` a `http://127.0.0.1:4175/` y reinicia Vite. Prueba `about`, `essays`, `essays list` y `essays first-essay`. Restablece la raíz anterior al terminar. Los dos sitios reutilizan la misma aplicación sin cambiar código de producción.

La versión 0.1.0 conserva pendientes las comprobaciones con lectores de pantalla, teléfonos físicos y Pages real. Estas verificaciones no se afirman como completadas por ejecutar pruebas locales.

## Verificación de 0.1.0

El 16 de noviembre de 2026 se comprobaron la instalación con lockfile congelado, las comprobaciones de tipos de aplicación y Core, las **527 pruebas en 25 archivos** y la compilación de producción. La integración HTTP verifica tanto external-site (español e inglés) como ui-site, sin modificar la aplicación para cambiar de catálogo. Las pruebas de foco verifican que enlaces, bloques de código, historial y botones conservan el foco incluso al terminar un comando.

Esta verificación local no implica publicación en Pages ni pruebas en dispositivos físicos. La discrepancia anterior de las expectativas de help quedó corregida en las pruebas: ahora verifican los usos separados y la descripción sin exigir el formato antiguo con barras verticales.
