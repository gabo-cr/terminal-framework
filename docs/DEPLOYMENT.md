# GitHub Pages

La aplicación se publica como SPA estática; el repositorio externo sirve los JSON
y Markdown públicos. No se copian contenidos ni fixtures al artefacto de la app.

## Configurar el repositorio de la aplicación

1. En **Settings → Pages → Build and deployment → Source**, seleccionar
   **GitHub Actions**. No seleccionar una rama de publicación.
2. En **Settings → Secrets and variables → Actions → Variables**, crear una
   variable de repositorio `VITE_CONTENT_BASE_URL` con la raíz HTTPS publicada
   del repositorio externo, por ejemplo `https://example.github.io/site-content/`.
   El ejemplo es ilustrativo: debe sustituirse por una URL real.
3. Opcionalmente crear `VITE_BASE_PATH`. Su valor predeterminado es
   `/terminal-framework/`. Debe comenzar y terminar con `/`; el workflow admite
   segmentos alfanuméricos, guiones y guiones bajos.
4. Cuando se decida publicar, incorporar el workflow a `main` y ejecutar
   **Actions → Deploy to GitHub Pages → Run workflow**, seleccionando `main`.
   Solo tiene disparador manual; un push no publica. La ejecución desde otra
   rama se omite. Este cambio no ejecuta el workflow ni modifica Settings.

El workflow usa Node 24 y la versión de pnpm de `packageManager`. Ejecuta
`pnpm install --frozen-lockfile`, `pnpm run typecheck`, `pnpm run typecheck:core`,
`pnpm run test` y `pnpm run build`. Si falla un paso no se despliega. Las pruebas
HTTP utilizan servidores locales efímeros, no el servidor externo.

Solo `dist` se carga mediante `actions/upload-pages-artifact`; un segundo job
usa `actions/configure-pages` y `actions/deploy-pages`, con el entorno
`github-pages` y permisos `pages: write` e `id-token: write`. No requiere PAT,
commits de dist ni rama gh-pages. Pueden aplicarse reglas de aprobación al entorno
desde Settings si se desea. El workflow comprueba que la raíz está definida y
es HTTPS; las reglas completas de rutas, esquemas y referencias siguen
validándose en el bootstrap de la aplicación.

## Repositorio externo

Su publicación debe exponer exactamente estas rutas desde la raíz configurada:

```text
config/site.json
config/commands.json
config/content.json
documents/... (rutas relativas declaradas en content.json)
```

Los archivos deben ser accesibles sin autenticación y permitir CORS para el
origen de la aplicación. Verificar las URLs publicadas de los tres JSON y de al
menos un Markdown en el navegador. Usar la URL HTTPS final, evitando
redirecciones: el proveedor las rechaza. Si el sitio externo utiliza Jekyll,
asegurarse de que publica los Markdown como archivos descargables originales;
una publicación estática sin procesamiento es la opción sencilla.

`VITE_CONTENT_BASE_URL` y `VITE_BASE_PATH` son públicas y se incorporan al build.
No son secretos ni se leen desde GitHub al abrir la página. Cambiar las variables
requiere otra ejecución del workflow. Modificar Markdown en el sitio externo no
requiere reconstruir la app; la caché en memoria se renueva en una nueva sesión.

## Dominio personalizado

Configurar el dominio en **Settings → Pages → Custom domain**, completar sus DNS
y habilitar HTTPS según indique GitHub. Establecer `VITE_BASE_PATH=/` y volver a
ejecutar el workflow. La raíz externa de contenidos sigue configurándose de forma
independiente. No es necesario cambiar el Core ni añadir CNAME al artefacto del
workflow: el dominio se configura en Settings.

## Verificación local

```sh
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run typecheck:core
pnpm run test
VITE_BASE_PATH=/terminal-framework/ pnpm run build
pnpm run preview
```

Abrir `/terminal-framework/` en preview. Para verificar el dominio personalizado,
reconstruir con `VITE_BASE_PATH=/` y abrir `/`. En ambos casos configurar una raíz
de contenidos HTTPS real para verificar el arranque de producción. HTTP local
está permitido exclusivamente en desarrollo; no se habilita para preview.

En `dist/index.html`, los atributos src/href de JavaScript y CSS deben empezar
por `/terminal-framework/assets/` o `/assets/` respectivamente y corresponder a
archivos de `dist/assets`. No hay router con rutas de página ni necesidad actual
de fallback 404 personalizado.

Referencias oficiales: [Vite: GitHub Pages](https://vite.dev/guide/static-deploy#github-pages),
[workflows de Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
y [fuente de publicación](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Resultado de la preparación

Se ejecutaron instalación con lockfile congelado, comprobaciones de tipos de app
y Core, las 521 pruebas (24 archivos) y builds con ambas bases. Se verificó que los
dos enlaces de JavaScript y CSS de cada index.html apuntan a archivos existentes
con el prefijo esperado. El build final utiliza `/terminal-framework/`; dist solo
contiene index.html y assets. `git diff --check` pasa.

La ejecución remota del workflow y el arranque contra el repositorio real de
contenidos quedan pendientes: no se ha facilitado su URL ni se han configurado
variables o Pages en GitHub. No se realizó publicación ni commit. La comprobación
local no sustituye la primera ejecución autorizada de Actions.
