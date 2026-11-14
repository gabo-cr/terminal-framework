# terminal-framework

Framework para sitios personales explorables mediante una terminal interactiva.
Este incremento contiene la base técnica, los contratos de configuración,
su carga remota y una página temporal.
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

La página temporal se monta después de cargar y validar los tres archivos.
Si falla la configuración, el arranque se detiene y registra el error en consola;
la presentación de estados de carga y error queda para un próximo incremento.
No se descargan documentos Markdown ni se validan aún referencias entre archivos.

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
