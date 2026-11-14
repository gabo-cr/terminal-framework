# Instrucciones para Codex

- Lee `docs/PROJECT.md` antes de trabajar: contiene la visión, la arquitectura aprobada y los límites del MVP.
- Usa pnpm para instalar dependencias y ejecutar scripts. Conserva `pnpm-lock.yaml` como único lockfile y respeta la versión fijada en `package.json`.
- Trabaja incrementalmente, con cambios pequeños y verificables. Implementa solo el incremento solicitado.
- El primer incremento abarca infraestructura, carga remota de los tres JSON, validación de contratos y referencias, y presentación básica del sitio. En el Incremento 2, el alcance autorizado abarca el parser puro, CommandRegistry y los comportamientos internos help, clear e history en `src/core`; no implementes todavía CommandExecutor ni terminal interactiva.
- Usa React, TypeScript, Vite, Tailwind CSS, Zod y Vitest. Mantén el core independiente de React y respeta los módulos previstos en `docs/PROJECT.md`.
- Obtén configuración y contenidos de la raíz definida mediante `VITE_CONTENT_BASE_URL`; no acoples la aplicación al contenido del primer sitio personal.
- Impide el estado `ready` ante cualquier JSON inválido, fallo de carga de configuración o referencia inválida. Los Markdown se cargarán bajo demanda en un incremento posterior.
- Ejecuta las pruebas pertinentes para los cambios de implementación, especialmente carga remota, validación y referencias. Informa qué verificaste y cualquier impedimento; no afirmes que pasaron pruebas que no ejecutaste.
- Evita complejidad prematura: no añadas funcionalidades fuera de alcance, dependencias innecesarias, módulos vacíos ni abstracciones especulativas.
- Conserva los cambios existentes del usuario. Documenta las decisiones asumidas y actualiza el contexto cuando se aprueben cambios de alcance o arquitectura.
- En la tarea documental inicial no crees la aplicación ni instales dependencias. El scaffolding y la instalación corresponden a una tarea posterior de implementación.
