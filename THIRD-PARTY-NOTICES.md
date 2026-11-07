# Avisos de terceros / Third-party notices

El código propio de Coach LoL IA se publica bajo la licencia MIT (ver `LICENSE`). Los componentes de terceros
conservan sus propias licencias; este archivo resume los principales. La lista completa de dependencias, con su
licencia, está en `package-lock.json`, `app/package.json` y `web/package-lock.json`.

| Componente | Dónde se usa | Licencia |
| --- | --- | --- |
| Electron, React, Vite, Astro y el resto de dependencias de npm | App de escritorio y web | Principalmente MIT, Apache-2.0, ISC y BSD; algunas MPL-2.0 o LGPL solo en herramientas de compilación |
| ONNX Runtime | App (voz natural) | MIT |
| Modelo de voz natural (Supertonic 3, de Supertone Inc.) | App, se descarga aparte | BigScience OpenRAIL-M, con restricciones de uso; su `LICENSE` va dentro del paquete de voz |
| Fuente Inter | Web | SIL Open Font License 1.1; texto completo en `web/public/licencias/inter-OFL-1.1.txt` (publicado en `/licencias/inter-OFL-1.1.txt`) |
| Datos y recursos de League of Legends (Data Dragon, Community Dragon, API de Riot) | App y web | Propiedad de Riot Games, usados según las políticas para desarrolladores de Riot |

Coach LoL IA isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone
officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are
trademarks or registered trademarks of Riot Games, Inc.

_Hecho con ayuda de IA._
