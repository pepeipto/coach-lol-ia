# Bots y webhook de GitHub

## Lo que no necesita ningún bot

Discord ya trae gratis lo que antes hacían los bots. El script lo deja configurado:

| Necesidad | Herramienta nativa |
| --- | --- |
| Moderación automática | **AutoMod** (6 reglas: trampas y cuentas, apuestas y estafas, invitaciones, insultos, spam de menciones y spam). |
| Roles autoasignables | **Canales y roles** (preguntas al entrar, cambiables siempre). Sustituye a los «roles por reacción». |
| Bienvenida | **Mensajes de sistema** en #general, **Guía del servidor** (tareas de nuevo miembro) y el mensaje fijado de #bienvenida. |
| Eventos | **Eventos del servidor** (botón «Crear evento») y el escenario «Charlas y eventos». |
| Copia de seguridad | **Plantilla del servidor**: Ajustes del servidor → Plantilla del servidor → Generar plantilla. Guarda canales, roles y permisos (no los mensajes). |

Cuantos menos bots, menos permisos peligrosos repartidos y menos cosas que se rompen.

## Bots instalados

| Bot | Estado | Permisos | Uso |
| --- | --- | --- | --- |
| **Jockie Music** | Añadido el 22-10-2026 | Ver canales, enviar mensajes, insertar enlaces, leer historial, conectar y hablar (sin Administrador) | Entra en la sala de voz «🎵 Música» y usa `/play` con una canción o un enlace. Su ficha anuncia Spotify, Apple Music y Deezer. Que reproduzca YouTube no está comprobado: Google lo persigue y puede dejar de funcionar. |
| **PatchBot** | Añadido el 22-10-2026 por Carlos; en #parches puede ver el canal y enviar mensajes | Ver canales, enviar mensajes, insertar enlaces, leer historial | Publica en #parches cada parche de League of Legends. |

**Si hubiera que volver a añadir PatchBot (unos 3 minutos).** PatchBot no se puede autorizar desde la app de Discord: pide pasar por su web («Integration requires code grant»).
1. En el navegador donde tengas abierta tu sesión de Discord, entra en https://patchbot.io y pulsa **Add to Discord**.
2. Elige el servidor **Coach LoL IA**. Deja solo los permisos de ver canales, enviar mensajes, insertar enlaces y leer historial, y pulsa **Autorizar**. Si sale un CAPTCHA, resuélvelo tú.
3. En el panel de patchbot.io, entra en **Coach LoL IA**, busca **League of Legends** y elige el canal **#parches**.
4. #parches es de solo lectura, así que hay que dejar escribir al bot: #parches → ⚙️ Editar canal → Permisos → Permisos avanzados → **+** → **PatchBot** → ✓ en **Enviar mensajes** e **Insertar enlaces** → Guardar.

Los enlaces de autorización con permisos mínimos de los dos bots están en un mensaje de #equipo.

## Bots gratuitos recomendados (opcionales)

Añádelos solo cuando haga falta, y siempre desde su web oficial. Al autorizarlos, **desmarca «Administrador»** si lo piden y deja solo los permisos que use cada función. Esto lo hace Carlos con su cuenta.

| Bot | Para qué | Cuándo añadirlo | Coste |
| --- | --- | --- | --- |
| **Carl-bot** (carl.gg) | Registro de mensajes editados y borrados en #moderacion, roles por reacción (plan B si «Canales y roles» no te convence) y mensajes de bienvenida personalizados. | Con más de ~100 miembros, cuando haga falta saber qué se borró. | Gratis (Premium opcional, no hace falta). |
| **Wick** (wickbot.com) | Anti-raid y anti-nuke: frena oleadas de cuentas falsas y que alguien con permisos borre canales en masa. | Si el servidor crece rápido (vídeo viral) o hay un ataque. | Gratis lo básico. |
| **Statbot** (statbot.net) | Estadísticas: mensajes, miembros activos y retención por día. | Desde el principio, para las [métricas](promocion.md#métricas). | Gratis lo básico. |
| **Streamcord** (streamcord.io) | Aviso automático en #directos cuando un Streamer empieza en Twitch. | Cuando haya 3 o más streamers. | Gratis lo básico. |

**No recomendados:** MEE6 (lo útil es de pago), bots de MMR o de «rangos ocultos» (Riot no permite calcular el MMR) y cualquier bot de apuestas, casinos o economía con dinero real.

## Webhook de GitHub: cada release en #novedades

Cuando publicas una release de `pepeipto/coach-lol-ia` en GitHub, aparece sola en #novedades con sus notas, el enlace de descarga y una mención al rol **Avisos de novedades** (solo a quien la pidió).

**Cómo funciona.** El workflow [`.github/workflows/discord-novedades.yml`](../../.github/workflows/discord-novedades.yml) se lanza al **publicar** una release (no con los borradores ni con las versiones marcadas como *pre-release*) y la envía al webhook «GitHub» de #novedades. Lo usamos en vez del webhook directo de GitHub porque así el mensaje sale en español, con el enlace de descarga, una sola vez por versión y con la mención al rol.

**Configuración.** El script la hace sola si respondes «s» a «¿Guardo el webhook como secreto...?» (necesita [GitHub CLI](https://cli.github.com) con `gh auth login` hecho). A mano:
1. El script ha copiado la URL del webhook al portapapeles. Si no, en Discord: #novedades → ⚙️ Editar canal → Integraciones → Webhooks → «GitHub» → **Copiar URL del webhook**.
2. GitHub → repositorio → **Settings → Secrets and variables → Actions**:
   - Pestaña **Secrets** → **New repository secret** → nombre `DISCORD_WEBHOOK_NOVEDADES`, valor: pega la URL.
   - Pestaña **Variables** → **New repository variable** → nombre `DISCORD_ROL_NOVEDADES`, valor: el número que muestra el script (ID del rol «Avisos de novedades»). Es opcional: sin él, el aviso no menciona a nadie.

**Probarlo.** GitHub → **Actions → Discord novedades → Run workflow**: vuelve a anunciar la última release. Si sale bien en #novedades, ya está.

La URL del webhook es secreta (quien la tenga puede escribir en #novedades): no la pegues en chats ni en archivos. Si se filtra, bórrala en Discord (Integraciones → Webhooks → Eliminar), vuelve a ejecutar el script y guarda la nueva.

**Plan B sin workflow.** GitHub → Settings → Webhooks → Add webhook → *Payload URL*: la URL del webhook de Discord **terminada en `/github`** → *Content type*: `application/json` → *Let me select individual events* → solo **Releases**. Sale en inglés y sin mención al rol.
