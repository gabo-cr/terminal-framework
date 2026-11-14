# terminal-framework

Framework para sitios personales explorables mediante una terminal interactiva.
Este incremento contiene la base técnica, los contratos de configuración,
su carga remota y la primera interfaz de presentación.
Consulta [el contexto del proyecto](docs/PROJECT.md) para conocer el alcance aprobado.

## Desarrollo

Usa Node.js 22.12+ (rama 22), 24.x o 26+ y pnpm 12.6.0 (versión fijada en `package.json`).

```sh
pnpm install --frozen-lockfile
pnpm run dev
```

Copia `.env.example` a `.env.local` y configura `VITE_CONTENT_BASE_URL` con la
raíz pública de tus contenidos. Se requieren estos archivos:

```text
<raíz>/config/site.json
<raíz>/config/commands.json
<raíz>/config/content.json
```

La raíz requiere HTTPS; HTTP solo funciona en desarrollo con `localhost`,
`127.0.0.1` o `[::1]`. El servidor de contenidos debe permitir CORS para el
origen de la aplicación si ambos son distintos. La variable se incorpora al
bundle durante el build, según el comportamiento de Vite.

React muestra estados de carga, error con reintento y contenido listo. El bootstrap
valida los tres archivos y sus referencias antes de mostrar el sitio. Los colores,
la bienvenida, el título HTML y la descripción se toman de la configuración.
Antes de conocer el idioma del sitio, carga y errores usan el idioma del navegador
(inglés si empieza por `en`, español en los demás casos).

## Fixtures de pruebas

Las pruebas automatizadas están en `tests/`, agrupadas por módulo. Las fixtures
mínimas de UI se conservan en `tests/fixtures/ui-site` y se usan mediante respuestas
simuladas en `tests/app/App.test.tsx`. Su nombre es genérico y no se incluyen en el
build de producción. El ejemplo HTTP completo se describe a continuación.

## Sitio externo de pruebas

El conjunto completo del Incremento 3 está en `tests/fixtures/external-site`, servido
por un proceso HTTP separado de Vite:

```sh
pnpm run fixtures:serve
```

En otra terminal:

```sh
VITE_CONTENT_BASE_URL=http://127.0.0.1:4174/ pnpm run dev
```

Para verificar configuración, motor, descargas reales y caché sin interfaz
interactiva, ejecuta `pnpm run test:contents:http`. La prueba inicia su propio
servidor efímero y no necesita que el servidor manual esté activo. Lee el
[informe de verificación](docs/INCREMENT-3.md) para ver los casos y limitaciones.

## Verificación

```sh
pnpm run typecheck
pnpm run typecheck:core
pnpm run test
pnpm run build
pnpm run preview
```

Vitest ejecuta las pruebas una vez con `pnpm run test`. Para modo interactivo usa
`pnpm run test --watch`. El build estático se genera en `dist/` con rutas de
assets relativas, compatibles con publicación en un subdirectorio de GitHub Pages.
