# Servidor oficial de Discord de Coach LoL IA

Aquí está todo lo necesario para montar y hacer crecer la comunidad de Coach LoL IA en Discord.

| Archivo | Para qué sirve |
| --- | --- |
| Este README | Guía paso a paso para crear el servidor (unos 20 minutos). |
| [diseno-servidor.md](diseno-servidor.md) | Categorías, canales, roles, permisos, AutoMod y «Canales y roles». |
| [bots-y-webhook.md](bots-y-webhook.md) | Bots gratuitos recomendados y el anuncio automático de cada release en #novedades. |
| [promocion.md](promocion.md) | Plan para atraer gente, colaborar con otros servidores, eventos y métricas. |
| [mensajes/](mensajes/) | Textos fijados de cada canal, en español y en inglés. Si cambias uno, vuelve a ejecutar el script y se actualiza. |
| [`tools/discord/`](../../tools/discord/) | El programa que lo crea todo de una vez (`servidor.mjs` es el diseño en código). |
| `Crear servidor Discord.bat` | El acceso directo que lo ejecuta (en la raíz del repositorio). |

> **Seguridad.** El token del bot es como una contraseña: quien lo tenga controla el bot, que es administrador del servidor. **Nunca** lo pegues en un chat (tampoco a Claude), ni en un archivo, ni en git. El acceso directo lo pide sin que se vea y lo olvida al terminar.

---

## Paso 1. Crear el servidor vacío (2 min)

1. En la app de Discord, pulsa el **+** de la columna izquierda (**Añadir un servidor**).
2. Elige **Crear el mío** → **Para un club o una comunidad**.
3. Nombre: **Coach LoL IA**. El icono no hace falta: el script pone el de la app si no tiene ninguno.
4. Pulsa **Crear**. Discord crea dos canales por defecto («general» y «General»); el script te ofrecerá borrarlos.

## Paso 2. Crear el bot que monta el servidor (5 min)

1. Abre https://discord.com/developers/applications e inicia sesión con tu cuenta de Discord (akira88) si te lo pide.
2. **New Application** → nombre **Coach LoL IA** → marca la casilla de los términos → **Create**.
   - En **General Information** puedes subir el icono `web/public/iconos/icono-512.png`: es la «cara» con la que salen los mensajes fijados.
3. Menú **Installation** → en **Install Link** elige **None** → **Save Changes**. Así nadie más puede añadir tu bot a otros servidores.
4. Menú **Bot**:
   - Desactiva **Public Bot** → **Save Changes**.
   - **No** hace falta activar ningún «Privileged Gateway Intent».
   - Pulsa **Reset Token** → **Yes, do it!** → **Copy**. Ya tienes el token en el portapapeles. No lo pegues en ningún otro sitio.

## Paso 3. Ejecutar el script (5 min)

1. Haz doble clic en **`Crear servidor Discord.bat`** (raíz del repositorio).
   - La primera vez instala discord.js (tarda unos segundos) y comprueba el diseño y los mensajes.
2. Cuando ponga «Pega el token», pulsa **clic derecho** (o Ctrl+V) y **Enter**. No verás nada al pegarlo: es normal.
3. Como el bot aún no está en tu servidor, el script **abre el navegador** con la página para añadirlo:
   - Elige el servidor **Coach LoL IA** → **Continuar** → deja marcado **Administrador** → **Autorizar**.
   - Vuelve a la ventana negra: el script lo detecta solo.
4. Responde **s** a las preguntas:
   - «¿Creo aquí los roles, canales...?» → **s**.
   - «¿Los borro?» (los canales que trae Discord por defecto) → **s**.
   - «¿Guardo el webhook como secreto del repositorio con gh?» → **s** (si tienes GitHub CLI con sesión iniciada; si no, el script copia la URL al portapapeles y te dice dónde pegarla; ver [bots-y-webhook.md](bots-y-webhook.md)).
5. Al final verás **¡Servidor listo!** y la **invitación permanente** (`https://discord.gg/...`).

Si algo falla a mitad, vuelve a abrir el acceso directo: lo que ya existe no se duplica, se actualiza.

## Paso 4. Cerrar la puerta (1 min)

1. Vuelve al Developer Portal → **Bot** → **Reset Token**. El token que usaste deja de funcionar (si algún día quieres volver a ejecutar el script, generas otro).
2. El bot puede quedarse en el servidor (desconectado no hace nada y así podrás actualizar los mensajes fijados más adelante).

## Paso 5. Repasar a mano (5 min)

Discord no deja hacer estas cosas desde un bot, o es mejor que las decidas tú:

1. **Ajustes del servidor → Perfil del servidor**: sube un **banner** (puedes usar `web/public/og/og-es.jpg`).
2. **Ajustes del servidor → Comunidad → Incorporación (Onboarding)**: comprueba que las preguntas de «Canales y roles» están activas (el script las crea; si falló, ver el paso 7).
3. **Ajustes del servidor → Comunidad → Guía del servidor**: activa la guía con 3 «tareas de nuevo miembro»: leer #reglas, elegir roles y presentarse en #general.
4. **Ajustes del servidor → Seguridad → AutoMod**: verás las 6 reglas creadas. Puedes añadir palabras cuando veas spam nuevo.
5. **Tu perfil**: dale a tu cuenta el rol **Equipo** (clic derecho sobre tu nombre → Roles → Equipo).
6. Entra desde **otra cuenta** (o pide a un amigo que entre con la invitación) para ver lo que ve un miembro nuevo.

## Paso 6. Poner la invitación en la web y en la app

Pásale a Claude la invitación del paso 3 (no es secreta, a diferencia del token). Claude la pondrá en:
- la web: constante `INVITACION_DISCORD` de `web/src/lib/sitio.ts` (aparece sola en el pie, en la FAQ de la portada y en las tarjetas de ayuda);
- la app: constante `URL_DISCORD` de `app/src/shared/comunidad.ts` y un botón en la vista Ayuda (hay que permitir el dominio `discord.gg` en `app/src/main/web.ts`).

La invitación no caduca y no tiene límite de usos. Si un día hiciera falta cambiarla (por ejemplo, por spam), crea otra desde #bienvenida → **Invitar** y cambia solo esas dos constantes.

## Paso 7. Si «Canales y roles» no se configuró solo

**Ajustes del servidor → Comunidad → Incorporación** → **Canales predeterminados**: marca los canales con «predeterminado» de [diseno-servidor.md](diseno-servidor.md). Después, en **Preguntas**, crea estas 5 (en cada opción, el rol del mismo nombre):

| Pregunta | Opciones | Tipo |
| --- | --- | --- |
| ¿En qué idioma prefieres hablar? · Language | ES, EN | varias, obligatoria |
| ¿En qué región juegas? · Region | EUW, EUNE, LAN, LAS, NA, BR | varias |
| ¿Cuál es tu rango actual? · Rank | Hierro … Maestro+ | una sola |
| ¿Qué posiciones juegas? · Roles | Top, Jungla, Mid, ADC, Support | varias |
| ¿Qué avisos quieres recibir? · Pings | Avisos de novedades, Avisos de retos | varias |

## Cambiar algo más adelante

- **Un texto fijado**: edita su archivo en `docs/discord/mensajes/` y vuelve a ejecutar el acceso directo (con un token nuevo). Se editan los mensajes del bot, sin duplicarlos.
- **Un canal o un rol nuevo**: añádelo en `tools/discord/servidor.mjs` y vuelve a ejecutarlo. Puedes comprobar el diseño sin conectarte con `npm run simular` dentro de `tools/discord`.
- **Probar el script**: `npm test` dentro de `tools/discord` comprueba el diseño, los límites de Discord y las reglas de Riot.
