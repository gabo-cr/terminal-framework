# Sitio externo ficticio

Servir desde la raíz del repositorio con `pnpm run fixtures:serve`.
Raíz de contenidos: `http://127.0.0.1:4174/`.

Los JSON válidos se encuentran en `config/`; los Markdown reales en `documents/`.
El catálogo incluye intencionalmente `documents/remote-missing.md`, que no existe,
para comprobar el error HTTP 404 y los reintentos. Las pruebas publican ese archivo
solo en una copia temporal de las fixtures.

`code react-hooks` incluye un documento largo, una línea de código ancha, texto
sin espacios y enlaces seguros/bloqueados para revisar diseño adaptable, teclado
y desplazamiento. Se reutiliza en las pruebas HTTP y en la revisión manual de la
[guía de desarrollo](../../../docs/development.md); no es contenido de producción.

Consulta [la guía de desarrollo](../../../docs/development.md) para reproducir la
verificación de todos los comandos, incluidos los listados, caché y recuperación.
