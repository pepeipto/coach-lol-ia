# Plan de promoción en Discord

**Situación.** La clave de producción de Riot está en revisión (App 895670). Hasta que la aprueben, **nada de lanzamiento masivo**: si llega mucha gente de golpe, el servidor de builds podría quedarse corto con la clave de desarrollo. El plan va por fases:

| Fase | Cuándo | Objetivo | Qué hacer |
| --- | --- | --- | --- |
| 0. Semilla | Ya | 20–50 miembros que de verdad usen la app | Amigos, clase, primeros usuarios. Enlace en la web y en la app. Carlos escribe a diario para que el servidor no parezca vacío. |
| 1. Lanzamiento | Con la clave de producción aprobada | 300–500 miembros | Vídeos verticales, Reddit, colaboraciones con servidores hispanos, primer torneo. |
| 2. Crecimiento | Desde 500 miembros | Comunidad que se mueve sola | Más moderadores del Equipo, eventos fijos, Descubrimiento de servidores de Discord (pide 1000 miembros). |

## Plan de noviembre de 2026 (de 19 a 100 miembros)

Situación el 8-11-2026: **19 miembros**, la invitación principal `wNrW7tREPJ` lleva 10 usos, #anuncios estaba vacío y el aviso automático de versiones en #novedades fallaba desde la 3.13.0 (secreto del webhook mal pegado).

**Hecho el 8-11-2026:**
- Novedades de la 3.16.0, la 3.17.0 y la 3.17.1 publicadas en #novedades (y enviadas a los servidores que siguen el canal) y primer aviso en #anuncios.
- Perfil del servidor con rasgos (Español, Coaching, Builds, Buscar dúo, TFT) y TFT como juego, para salir mejor en las búsquedas de Discord.
- Invitación permanente para redes: **discord.gg/c4QTy558Hm** (YouTube, TikTok, Instagram, X). La de la web y la app sigue siendo `wNrW7tREPJ`: así, en Ajustes del servidor → Invitaciones se ve qué trae más gente.
- Enlace corto **coachlolia.com/discord** (se puede decir en voz en los vídeos y escribir en la bio de TikTok aunque no deje enlazar) y botones «Unirme al Discord» en la vista Ayuda y en la ventana de novedades de la app (llegan con la 3.17.1).
- El workflow de #novedades limpia el secreto antes de usarlo y avisa claro si no es una URL de webhook.

**Lo que más gente trae, por orden:**

| # | Acción | Quién | Coste |
| --- | --- | --- | --- |
| 1 | Botón de Discord en la app (Ayuda y Novedades): cada usuario que actualiza lo ve. | Claude (PR listo, sale en la 3.17.1) | 0 € |
| 2 | Final de cada vídeo de TikTok/Shorts/Reels: «Únete al Discord: coachlolia.com/discord» y comentario fijado con la invitación de redes. | Hilo de redes | 0 € |
| 3 | Disboard (disboard.org): añadir el servidor con las etiquetas `league-of-legends`, `español`, `lol`, `coaching` y hacer `/bump` cada 2 horas cuando se pueda. | Carlos (pide iniciar sesión con Discord) | 0 € |
| 4 | Reto semanal cada lunes en #retos-de-la-semana (ideas en la tabla de abajo) y cierre el domingo. | Carlos o Claude | 0 € |
| 5 | Evento mensual: «ARAM de la comunidad» (partidas personalizadas, sin apuestas ni premios en dinero), creado en Eventos del servidor y anunciado en vídeo. | Carlos fija el día | 0 € |
| 6 | Invitar a los amigos de Discord de Carlos y a su clase (el botón «Invitar» del servidor). | Carlos | 0 € |
| 7 | Colaboración con 1 servidor hispano de LoL al mes (borrador más abajo). | Carlos envía | 0 € |
| 8 | Rol cosmético «Fundador» para los primeros 100 miembros: da motivo para entrar ya. | Claude/Carlos | 0 € |

**Lo que no hacemos:** comprar miembros, sorteos con dinero, skins o RP, pegar la invitación en servidores ajenos sin permiso, ni MD masivos.

**Meta:** 50 miembros a final de noviembre y 100 a mitad de diciembre. Se mira cada lunes en Invitaciones (usos por enlace).

## Cómo invitar a gente

**Una invitación por origen.** Discord cuenta los usos de cada invitación (Ajustes del servidor → Invitaciones), así sabremos qué canal funciona. Créalas desde #bienvenida → **Invitar a gente** → **Editar enlace de invitación** → «Caducar después de: **Nunca**», «Número máximo de usos: **Sin límite**».

| Origen | Dónde va | Texto sugerido |
| --- | --- | --- |
| Web | Pie de todas las páginas, FAQ de la portada y tarjetas de ayuda (constante `INVITACION_DISCORD`) | «Comunidad en Discord» |
| App | Vista **Ayuda** (botón) y, tras una actualización, en la ventana de novedades | «¿Dudas o ideas? Únete a la comunidad en Discord» |
| TikTok / Shorts / Reels | Bio y comentario fijado de cada vídeo | «Builds, retos y dúos 👉 coachlolia.com (Discord en el pie)». Si TikTok aún no te deja poner enlace en la bio (pide un mínimo de seguidores), pon la web en texto. |
| Reddit | Perfil y respuestas útiles (nunca el enlace solo) | Ver normas de cada subreddit: muchos prohíben invitaciones. |
| GitHub | README (insignia de Discord) y pie de cada release | «💬 Comunidad: discord.gg/…» |
| Colaboraciones | Una invitación por servidor socio | — |
| Correo de soporte | Firma de support@coachlolia.com | «También te ayudamos en Discord: …» |

La regla de AutoMod «Invitaciones a otros servidores» bloquea invitaciones en el chat salvo la oficial: si un miembro necesita pegar otra, el Equipo y los Streamer pueden.

## Colaboración con servidores hispanos de LoL

**A quién.** Servidores grandes de LoL en español (por ejemplo «League of Legends ESPAÑA», ~21.000 miembros), comunidades de LAN y LAS, clubs de esports universitarios y servidores de streamers pequeños y medianos.

**Cómo, sin que parezca spam:**
1. Entra, lee sus reglas y participa unos días como uno más. **Nunca** publiques la invitación en un servidor ajeno sin permiso.
2. Busca el canal de «partners», «colaboraciones» o «propuestas», o escribe **a un solo admin** (no a todos).
3. Ofrece algo útil para *su* comunidad, no solo publicidad:
   - que sigan nuestro #novedades desde su servidor (botón **Seguir**: les llegan las versiones nuevas sin hacer nada);
   - un reto conjunto o un torneo de comunidad juntos;
   - intercambio de canal de partners si tienen.
4. Si dicen que no o no responden en una semana, se deja estar.

**Borrador para un admin** (Carlos lo revisa, lo adapta y lo envía él mismo desde su cuenta):

> ¡Hola! Soy Carlos, desarrollo Coach LoL IA, una app gratuita y de código abierto para LoL (builds Esmeralda+, importación de runas y un coach con voz en español). No es oficial de Riot y solo usa sus API oficiales. Me gustaría proponeros algo para vuestra comunidad: [reto conjunto / torneo de comunidad sin apuestas / seguir nuestro canal de novedades]. Si os interesa os cuento los detalles, y si no, ¡gracias igualmente y perdón por la molestia!

**Directorios gratuitos de servidores:** Disboard (etiquetas `league-of-legends`, `español`, `lol`), Discadia y top.gg. Sube el servidor con el comando de «bump» cuando se pueda; no hace falta pagar nada.

## Eventos

### Retos semanales

Cada **lunes**, el Equipo publica en #retos-de-la-semana un reto con un **hilo** y menciona a **Avisos de retos**. El **domingo**, cierra el hilo y destaca a quienes lo cumplieron (y les da una reacción 🏆). Los retos se pueden seguir en la vista **Perfil** de la app.

Ideas para el primer mes (medibles y sin promesas de subir de rango):

| Semana | Reto |
| --- | --- |
| 1 | «Farmeo fino»: 7 de CS por minuto en 3 partidas. |
| 2 | «Ojos en el mapa»: 2 guardianes de control comprados en cada partida durante 5 partidas. |
| 3 | «Campeón nuevo»: 3 partidas con un campeón que nunca hayas jugado, importando su build con la app. |
| 4 | «Comparte tu build»: publica en #builds-y-runas la build que más te funciona y por qué. |

Premios: solo reconocimiento (mención, reacción, un rol cosmético temporal «Reto cumplido» si se quiere). **Nunca dinero, apuestas ni sorteos de pago.**

### Torneo de comunidad (sin apuestas)

- **Formato:** ARAM 5v5 o Grieta 5v5 en **partidas personalizadas**, equipos de la comunidad (#buscar-duo y sala «Clash · 5»). Cuadro gratis en start.gg o Challonge.
- **Normas:** inscripción **gratuita**, sin apuestas, sin premios en dinero, juego limpio y las reglas del servidor. Se presenta como «torneo de la comunidad de Coach LoL IA», **no** como torneo oficial, sin logotipos de Riot, y revisando antes las normas de torneos de comunidad de Riot.
- **Difusión:** evento del servidor + anuncio en #anuncios + vídeo corto con las mejores jugadas (#clips).
- Con un streamer de la comunidad narrándolo en directo, mejor.

### Otros eventos baratos

- **Presentación de cada versión** en el escenario «Charlas y eventos» (15 min, preguntas y respuestas).
- **Noche de clips**: votación de la mejor jugada de la semana en #clips.
- **Build battle**: dos miembros defienden su build para un mismo campeón; vota la comunidad.

## Anuncio de inauguración (borrador para #anuncios)

Carlos lo publica él mismo cuando el servidor esté repasado:

> 🎉 **¡Abrimos el Discord oficial de Coach LoL IA!**
> Aquí tienes ayuda con la app, las novedades de cada versión en cuanto salen, retos semanales, gente para jugar en #buscar-duo y un sitio para proponer ideas en #sugerencias.
> Empieza por <#bienvenida> y elige tus roles. ¡Invita a tu dúo!
>
> 🇬🇧 **The official Coach LoL IA Discord is open!** Get help, release news, weekly challenges and duo partners. Start in <#bienvenida> and pick your roles.

## Métricas

Míralas **cada lunes** y apuntarlas (basta una hoja de cálculo):

| Métrica | De dónde sale | Objetivo inicial |
| --- | --- | --- |
| Miembros totales y nuevos de la semana | Lista de miembros / Statbot | 100 el primer mes; 500 a los 3 meses del lanzamiento |
| Usos por invitación (origen) | Ajustes del servidor → Invitaciones | Saber qué origen trae más gente |
| Miembros que terminan «Canales y roles» | Información del servidor (Insights, cuando Discord lo active) | > 70 % |
| Retención a 7 días (nuevos que siguen y escriben) | Statbot / Insights | > 30 % |
| Miembros activos por semana (escriben o hablan) | Statbot | > 15 % del total |
| Tiempo hasta la primera respuesta en #soporte-y-bugs | Revisión manual | < 24 h |
| Bugs resueltos (etiqueta ✅) | Foro | La mayoría en la versión siguiente |
| Participación en el reto semanal | Hilo del reto | ≥ 10 personas |
| Descargas de la app | GitHub (descargas de cada release) | Comparar antes y después de cada acción |

**Rutina de Carlos (≈ 20 min al día):** responder #ayuda y #soporte-y-bugs, reaccionar a #clips y #builds-y-runas, escribir algo en #general. **Lunes:** reto nuevo y métricas. **Domingo:** cierre del reto.
