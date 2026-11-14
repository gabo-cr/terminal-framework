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

## Ejemplo por HTTP

Los archivos ficticios están en `public/example-content`, incluidos dos Markdown
que aún no se descargan ni renderizan. Para probarlos con Vite:

```sh
VITE_CONTENT_BASE_URL=http://localhost:5173/example-content pnpm run dev --port 5173 --strictPort
```

Abre `http://localhost:5173`. Puedes modificar un JSON del ejemplo para provocar
un error, restaurarlo y pulsar «Reintentar» sin recargar la página.
Para un build de producción se requiere una raíz HTTPS; la excepción HTTP local
solo se habilita en desarrollo. Los ejemplos públicos se incluyen en `dist/`.

## Verificación

```sh
pnpm run typecheck
pnpm run test
pnpm run build
pnpm run preview
```

Vitest ejecuta las pruebas una vez con `pnpm run test`. Para modo interactivo usa
`pnpm run test --watch`. El build estático se genera en `dist/` con rutas de
assets relativas, compatibles con publicación en un subdirectorio de GitHub Pages.
