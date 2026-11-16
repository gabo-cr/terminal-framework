# Despliegue en GitHub Pages

El despliegue tiene dos partes independientes: los archivos públicos de contenido y la aplicación estática que los consulta. No necesita backend. Con repositorios públicos, GitHub Pages está disponible en GitHub Free; consulta [las opciones de publicación oficiales](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## 1. Preparar el repositorio externo

Crea un repositorio para los JSON y Markdown, con esta estructura en la carpeta que vas a publicar:

```text
config/
  site.json
  commands.json
  content.json
documents/
  … archivos Markdown referenciados por content.json
.nojekyll
```

Usa los contratos y ejemplos de [site.json](configuration.md), [commands.json](commands.md) y [content.json](content.md). Las rutas del catálogo son relativas a la raíz publicada; respeta mayúsculas y minúsculas. Todos los archivos deben ser públicos y legibles sin autenticación.

Añade un archivo vacío `.nojekyll` a la raíz publicada para conservar los Markdown como archivos originales, sin transformación de Jekyll. GitHub documenta esta opción en [crear un sitio Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site).

## 2. Publicar los contenidos

En **Settings → Pages** del repositorio de contenidos, selecciona **Deploy from a branch**, elige la rama que contiene los archivos y la carpeta de publicación (raíz o `/docs`, según dónde los hayas colocado). Guarda y espera a que termine la publicación.

Esta selección por rama corresponde al repositorio de contenidos. La aplicación utilizará GitHub Actions.

## 3. Comprobar los archivos publicados

Copia la dirección real que muestra Pages. Desde esa raíz, abre:

- `config/site.json`
- `config/commands.json`
- `config/content.json`
- Al menos una ruta Markdown declarada en `content.json`.

En Network del navegador comprueba respuestas exitosas, JSON auténtico y Markdown como texto original, no una página HTML de error o un documento transformado. Usa la dirección HTTPS final, sin redirecciones. No confundas la página de GitHub que muestra un archivo con su URL pública publicada.

Abrir un archivo directamente no comprueba CORS: la lectura desde la aplicación se verificará después.

## 4. Configurar las variables de la aplicación

En el repositorio del framework, entra en **Settings → Secrets and variables → Actions → Variables** y configura:

| Variable | Valor |
| --- | --- |
| `VITE_CONTENT_BASE_URL` | Raíz HTTPS real de los contenidos, terminada en `/`, sin añadir `config/site.json` |
| `VITE_BASE_PATH` | Ruta pública de la aplicación; opcional, predeterminada `/terminal-framework/` |

Son variables públicas de compilación, no secretos. `.env.local` sirve para tu equipo y no se envía al workflow.

## 5. Revisar Actions y habilitar Pages

El workflow existente es [deploy.yml](../.github/workflows/deploy.yml). Debe estar en `main` para poder utilizar el disparador manual desde esa rama. No hace falta crear otro workflow ni añadir tokens personales.

Utiliza pnpm según `packageManager` y Node 24. El job `build` comprueba las variables y ejecuta:

```sh
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run typecheck:core
pnpm run test
pnpm run build
```

Carga exclusivamente `dist/` como artefacto. El job `deploy` usa el entorno `github-pages`, con permisos `pages: write` e `id-token: write`. Si falla la construcción, no publica. Las pruebas usan servidores locales de prueba; no verifican los contenidos reales de Internet.

En **Settings → Pages → Build and deployment → Source** del repositorio de la aplicación selecciona **GitHub Actions**. Comprueba que Actions está permitido para el repositorio y que las reglas del entorno `github-pages` permiten el despliegue.

## 6. Establecer la base de Vite

[vite.config.ts](../vite.config.ts) obtiene `base` de `VITE_BASE_PATH` y usa `/terminal-framework/` como alternativa. No necesitas editar el archivo para cambiar de alojamiento.

| Publicación | Base |
| --- | --- |
| Bajo la ruta del repositorio actual | `/terminal-framework/` |
| Bajo otra ruta de repositorio | `/NOMBRE-REAL-DEL-REPOSITORIO/`, sustituyendo el marcador |
| En la raíz del sitio, incluido un dominio personalizado | `/` |

El workflow acepta `/` o segmentos alfanuméricos, guiones y guiones bajos, con barras inicial y final. `VITE_CONTENT_BASE_URL` sigue siendo independiente de esta base.

## 7. Ejecutar el despliegue

En **Actions → Deploy to GitHub Pages → Run workflow**, selecciona `main` y ejecuta. El disparador es únicamente manual: un push no publica. Si seleccionas otra rama, la condición del job omite la construcción.

Espera a que terminen `build` y `deploy`. Abre la URL que devuelve el despliegue. No es necesario hacer commits de `dist/` ni crear una rama `gh-pages` para la aplicación.

## 8. Verificar el sitio

En la URL publicada:

1. Comprueba nombre, descripción, bienvenida, colores e idioma.
2. Ejecuta `help`, un comando de documento, uno de colección y su variante `list`.
3. Abre un documento de la colección y comprueba que el Markdown se presenta correctamente.
4. Prueba `history` y `clear`.
5. En Network revisa la descarga de los tres JSON y del Markdown solicitado. Comprueba que las URLs permanecen bajo la raíz esperada y no redirigen.
6. Si aplicación y contenidos tienen distinto origen, comprueba que el servidor devuelve `Access-Control-Allow-Origin` compatible con el origen de la aplicación (o `*`, al ser archivos públicos sin credenciales). Revisa también la consola por errores CORS.

No se puede resolver CORS en el cliente ni mediante `base`: debe permitirlo el servidor de contenidos. El workflow no descarga esos archivos y no sustituye esta verificación.

## 9. Actualizar contenidos

Modifica los JSON o Markdown en el repositorio externo y espera su nueva publicación. Si conservas la raíz y los contratos, no necesitas reconstruir el framework. Abre una sesión nueva o recarga la aplicación: la configuración se carga al iniciar y el Markdown ya consultado permanece en memoria durante la sesión; la caché HTTP del alojamiento también puede retrasar cambios.

Si cambias `VITE_CONTENT_BASE_URL` o `VITE_BASE_PATH`, vuelve a ejecutar el workflow: las variables están incorporadas al build, no se consultan desde GitHub al visitar la página.

## 10. Dominio personalizado opcional

No hace falta comprar un dominio para usar Pages. Si ya tienes uno, configúralo en **Settings → Pages → Custom domain** del repositorio de la aplicación, ajusta los DNS con tu proveedor y habilita HTTPS cuando esté disponible. Sigue [la guía oficial de dominios](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site) y [la de HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https).

Configura `VITE_BASE_PATH=/` y vuelve a desplegar. Con el workflow de Actions existente, el dominio se configura en Settings; no hace falta añadir un archivo CNAME al artefacto. Si el servidor de contenidos restringe CORS a un origen concreto, actualízalo al nuevo origen. La raíz de contenidos sigue configurándose por separado; si también cambia de dominio, actualiza su variable y evita direcciones que redirijan.

## Errores frecuentes

| Problema | Solución |
| --- | --- |
| Workflow ausente u omitido | Comprueba que está en `main`, habilita Actions y ejecuta manualmente desde `main` |
| Fallo en “Check public build configuration” | Define la raíz HTTPS en Variables y una base con barras correctas; revisa el mensaje del job |
| Instalación congelada falla | Usa pnpm 12.6.0 y verifica coherencia entre `package.json` y `pnpm-lock.yaml`; no elimines el lockfile |
| Build o pruebas fallan | Reproduce los scripts de [desarrollo](development.md) y corrige el error antes de publicar |
| Deploy denegado | Revisa Pages con fuente GitHub Actions, permisos del workflow y reglas del entorno `github-pages` |
| Página vacía o assets 404 | Corrige `VITE_BASE_PATH` según la URL publicada y vuelve a generar/desplegar |
| Error al iniciar la terminal | Revisa los tres JSON, sus contratos, referencias y rutas; todos deben ser válidos |
| Error de red pese a que el archivo abre directamente | Revisa CORS y redirecciones desde Network; usa la URL HTTPS final |
| Markdown devuelve HTML o 404 | Comprueba `.nojekyll`, nombre y ruta del archivo y la carpeta publicada del repositorio externo |
| Solo falla un comando al leer | La configuración no verifica la existencia remota de Markdown; corrige el archivo y vuelve a ejecutar el comando |
| Cambios no visibles | Espera la publicación externa y abre una sesión nueva; si cambiaste variables, reconstruye la aplicación |
| Preview rechaza fixtures HTTP | Usa contenidos HTTPS para preview; HTTP local solo se habilita con `pnpm dev` |
| HTTPS de dominio propio no disponible | Revisa DNS y estado del certificado siguiendo la guía oficial antes de probar el sitio |

## Alcance de las comprobaciones

El workflow valida el formato básico de las variables, pero las reglas completas de rutas y contratos se verifican en el arranque del navegador. Un despliegue exitoso no garantiza contenidos válidos ni CORS correcto.

Esta guía documenta la configuración del repositorio y no implica que Pages esté habilitado o que exista un despliegue público verificado. La revisión remota necesita las URLs reales y acceso a los resultados de Actions.
