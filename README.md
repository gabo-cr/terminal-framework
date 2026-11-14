# terminal-framework

Framework para sitios personales explorables mediante una terminal interactiva.
Este incremento contiene únicamente la base técnica y una página temporal.
Consulta [el contexto del proyecto](docs/PROJECT.md) para conocer el alcance aprobado.

## Desarrollo

Usa Node.js 22.12+ (rama 22), 24.x o 26+ y pnpm 12.6.0 (versión fijada en `package.json`).

```sh
pnpm install --frozen-lockfile
pnpm run dev
```

`.env.example` documenta `VITE_CONTENT_BASE_URL`. La variable aún no se consume;
la carga remota se implementará en un incremento posterior.

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
