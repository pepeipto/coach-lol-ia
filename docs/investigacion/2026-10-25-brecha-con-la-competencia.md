# Brecha con la competencia (Blitz y compañía) — 25-10-2026

Equipo de investigación de Coach LoL IA. Versión de referencia: **Coach LoL IA 3.9.0** (CHANGELOG del 25-10-2026). Parche del juego en las webs revisadas: **26.21**.

## Cómo se ha hecho

- Las webs de la competencia se han abierto hoy en el navegador integrado, porque varias (blitz.gg, u.gg, mobalytics.gg, metasrc.com) devuelven 403 a una descarga automática. Se ha usado Ahri en medio como campeón de ejemplo.
- Las normas de Riot se han leído en el portal oficial de desarrolladores y en el artículo de soporte sobre la memoria del juego.
- Las apps de escritorio **no se han instalado hoy**. Para el detalle de Blitz e iTero dentro de la app se usa el estudio previo [`docs/competencia-blitz-itero-gamecoach.md`](../competencia-blitz-itero-gamecoach.md) del 22-10-2026, hecho con las apps instaladas. En las tablas se marca como **(est. 22-10)**.
- **s/c = sin comprobar**: no se ha podido verificar en una fuente primaria. Porofessor tiene la web tras un reto de Cloudflare y su ficha de Overwolf da 404, así que casi toda su columna sale de terceros o queda s/c. Tampoco se ha encontrado la web de producto de **Game Coach AI**: lo que se sabe de ella viene del estudio del 22-10.

## 0. Hallazgos que cambian prioridades

1. **OP.GG ya tiene un coach por voz con IA** ([op.gg/ai](https://op.gg/ai)). Da consejos de línea, avisos de objetivos, recalls y objetos del rival («Enemy Xerath just finished Zhonya's»), y deja **preguntar en voz alta durante la partida**. Usa voces de streamers (Dopa, NeekoLUL…). Las voces por defecto son gratis y las de creadores van con suscripción. La página solo enseña el selector «EN»: el **español no consta** (s/c). La voz deja de ser algo exclusivo nuestro; lo que nos diferencia es **voz en español, sin conexión, gratis y de código abierto**.
2. **Blitz enseña Arena con % de uso (PR), posición media, % de primer puesto y % de top 4, nunca con % de victorias** ([blitz.gg/lol/champions/ahri/arena](https://blitz.gg/lol/champions/ahri/arena)). Es la forma de dar datos de Arena y Caos sin incumplir la norma que prohíbe los % de victorias de aumentos y objetos de Arena. Nosotros ahora solo damos el nivel (tier) del aumento.
3. **Riot no permite mantener un producto público con una clave de desarrollo.** El portal dice literalmente: «You may not maintain a public product with a development API key» ([developer.riotgames.com/docs/portal](https://developer.riotgames.com/docs/portal)). Nuestro servidor público funciona hoy con una clave de desarrollo mientras la de producción (App 895670) está en revisión. Es un **riesgo para la propia solicitud**. Todo lo que gaste más llamadas a la API de Riot debería esperar a la clave de producción.
4. **Desde el 6-10-2026 Riot bloquea el acceso a la memoria del juego** a las apps desconocidas. Las aprobadas tienen de plazo hasta **abril de 2027** para pasarse a las API oficiales ([soporte de Riot](https://support.riotgames.com/ar-ae/riot/performance/game-memory-access-removed-for-third-party-apps)). Los overlays de la competencia que leen memoria, como las definitivas aliadas de Blitz e iTero o el rastreador de daño de iTero, pueden desaparecer. Nosotros nunca hemos leído memoria, así que esto juega a nuestro favor.
5. **Las versiones de pago de la competencia cobran por cosas que podemos dar gratis con datos locales.** U.GG PLUS (desde 2,49 $ al mes en el plan anual) incluye «Personal Counters & Stats», «Personal Tier List» y una integración con Discord con resúmenes automáticos después de cada partida ([u.gg/plus](https://u.gg/plus)). Blitz Premium cobra las builds de Maestro+ y las de one-tricks en la app ([blitz.gg/premium](https://blitz.gg/premium)).

## 1. Tabla de funciones por fase

Leyenda: **Sí** · **No** · **Parcial** · **s/c** (sin comprobar) · **🔒** (de pago) · **en curso** (se está añadiendo).

| Función | Blitz | Porofessor | Mobalytics | U.GG | OP.GG | iTero | Coach LoL IA 3.9 |
|---|---|---|---|---|---|---|---|
| **Perfil e historial** | | | | | | | |
| Buscar el perfil de cualquier jugador (Nombre#Etiqueta) | Sí (buscador en la web) | Sí (búsqueda de partida en vivo) | s/c | Sí | Sí | s/c | No (solo tu cuenta, por la LCU) |
| Historial con los 10 jugadores | Sí (est. 22-10) | s/c | s/c | Sí («Post-Game Analytics») | Sí | Sí (est. 22-10) | Sí |
| Gráfica de PL | Sí (est. 22-10) | s/c | Sí («LP tracking») | Sí («LP per game») | s/c | Sí (est. 22-10) | Sí |
| Nota o puntuación por partida | Sí: combate y farmeo sobre 100 (est. 22-10) | s/c | Sí: puesto del 1.º al 10.º | Sí («carry score») | Sí: OP Score de 0 a 10, MVP y ACE | Sí: draft y macro (🔒) | Sí: notas de 0 a 100 |
| Estadísticas y counters personales, tier list personal | No | s/c | s/c | 🔒 PLUS | s/c | Sí: tier list personal (est. 22-10) | Parcial («Tu coach» y tendencias; sin counters ni tier list personales) |
| Retos o metas de práctica | No | No | Sí («In-game goals», «Challenges») | No | s/c | Parcial («áreas de mejora») | Sí: retos de 7 días |
| Repeticiones o jugadas destacadas automáticas | No | No | Sí («Automatic highlight detection») | No | s/c | No | No |
| **Selección de campeón** | | | | | | | |
| Importar runas, hechizos y objetos | Sí | s/c (terceros dicen que sí) | Sí | Sí («Auto-Import Loadouts») | Sí («Auto rune setting») | Sí (est. 22-10) | Sí |
| Varias builds | Sí: Mejor, % de victorias y Común | s/c | Sí: popular, alternativa y fuera del meta | Sí | Sí | Sí | Sí |
| Counters de línea | Sí: puntuación, % en la partida y % en la fase de líneas | s/c («counterpick tips», según terceros) | Sí | Sí (+ personales 🔒) | Sí | Parcial | Sí (3.9) |
| % de fase de líneas | Sí | s/c | No | No visto | No visto | s/c | en curso |
| % de bans y de picks | Sí | s/c | Sí | Sí | Sí | s/c | en curso |
| Sinergias | Sí: tabla con «win rate delta» | s/c | Sí: «Best synergy (duo)» | s/c | Sí (por rol) | Parcial | en curso |
| Sugerencias de baneo y de pick | No | s/c («ban suggestions», según terceros) | Sí («counter picks») | Sí («best picks & counters») | Sí («Pick-and-ban recommendations») | Sí (draft con IA) | No |
| Builds de profesionales y one-tricks | Sí (OTP 🔒) | No | Enlace a lolvvv | Sí («Pro Builds») | Sí (esports.op.gg) | No | No |
| Filtros de rango, región y parche | Sí | — | Sí | Sí | Sí: 14 rangos y 16 servidores | Sí | No (solo Esmeralda+ en EUW, LAN y LAS) |
| Cambio de % respecto al parche anterior | Sí («Win Rate Change») | — | No visto | No visto | Sí (pestaña «Trends») | No | No (los datos se usan, pero no se enseñan) |
| Rendimiento por objeto | Sí («Item Performance») | — | No visto | Por espacio de objeto | Por profundidad de objeto | No | No |
| Claves, fortalezas, debilidades y campeones parecidos | Sí | — | Consejos y trucos | No visto | Consejos de la comunidad (beta) | No | No |
| Desglose del daño (AP, AD, verdadero) | Sí | — | No visto | No visto | No visto | No | No |
| Combos y guías en vídeo | No | — | Sí («Combos», «Expert Video Guide») | No | No | No | No |
| Tiempos objetivo de objetos | No | — | Sí («@ 10 sec / @ 3 min / @ 20 min») | No | No | No | No |
| **Pantalla de carga** | | | | | | | |
| Rango y datos de los 10 | Sí («Exploración en pantalla de carga») | Sí (es su función principal, según terceros) | Sí («Scout your lobby») | Sí («Live Game») | s/c | Sí | Sí, sin jugadores ocultos |
| Etiquetas de jugador | Sí (est. 22-10) | s/c («Player Tags», según terceros) | s/c | s/c | s/c | Sí | Sí, solo positivas o neutras |
| **En partida (overlay)** | | | | | | | |
| Objetivos con cuenta atrás | Sí | s/c | Sí (temporizadores de jungla) | s/c | Sí (también por voz) | Sí | Sí |
| Habilidad que toca subir | Sí | s/c | s/c | Sí | s/c | Sí | Sí |
| CS y KDA frente a una media | Sí (comparativa) | s/c | Sí | Sí («Live Stat Tracker» por elo) | s/c | Sí | Sí |
| Diferencia de oro en objetos | Sí | s/c | Sí | Sí («Team Gold Difference») | s/c | Sí | Sí |
| Aviso de «power spike» del rival (ha terminado un objeto clave) | No | s/c | Sí («powerspike notifications») | No | Sí (voz) | No | No |
| Temporizadores de reliquias de vida (ARAM) | Sí | s/c | s/c | s/c | s/c | Sí | No |
| Recordatorio de baratija | Sí | No | No | No | No | No | Sí |
| Definitivas de los aliados | Sí (puede depender de la memoria) | No | No | No | No | Sí | No |
| Ruta de jungla | Sí | No | s/c | No | No | No | Parcial (estimación del jungla enemigo) |
| Coach por voz | No | No | No | No | **Sí**, con IA y voces de streamers (🔒) | No | **Sí**: en español, sin conexión y gratis |
| Preguntar en voz alta durante la partida | No | No | No | No | **Sí** | No | No |
| **Post-partida** | | | | | | | |
| Análisis con IA en texto | No | No | Parcial («Challenger AI coach» en los enfrentamientos) | No | No visto | 🔒 (coach de macro) | **Sí**, gratis |
| Línea de tiempo y gráficas | Sí (est. 22-10) | s/c | Sí | Sí | Sí (OP Score cada 5 min) | Sí | Sí |
| Probabilidad de victoria por minuto | Sí (est. 22-10) | No | No | No | No | No | No |
| Tarjeta para compartir | Sí, tras Caos o Arena (est. 22-10) | No | No | Resumen en Discord 🔒 | s/c | No | Sí, vertical |
| **Modos especiales** | | | | | | | |
| ARAM | Sí | — | Sí | Sí | Sí | Parcial | Sí |
| ARAM: Caos (Mayhem), tier de aumentos | Sí, por niveles | — | Sí | Sí | Sí | Sí | Sí, por niveles + combos |
| Arena | Sí: PR, posición media y top 4 | — | Sí | s/c | Sí | s/c | Sí, builds sin estadísticas de aumentos |
| URF y modos rotativos | Sí: URF | — | No visto | No visto | Sí: URF, Brawl, Doom Bots, Nexus Blitz | No | Sí: rotativos con su build o la del mapa |
| **Tier lists** | | | | | | | |
| Por rol y modo | Sí: Solo/Dúo, Caos, Classic, ARAM, URF, Arena y Arena 3v3 | — | Sí | Sí | Sí | Sí | Sí |
| **Contenido y comunidad** | | | | | | | |
| Noticias y notas de parche | Sí («Noticias») | No | Blog | No visto | Sí (enlaces) | Artículos | No (solo novedades de la app) |
| Web en español | Sí (traducción parcial: la página de builds sigue en inglés) | s/c (/es/ existe, tras Cloudflare) | s/c | No visto | s/c | Parcial (pt-BR visto) | Sí, nativa |
| Modo streamer | s/c | Sí (etiqueta «Streamer Mode» en partidas) | s/c | No | Sí («Streamer Overlay») | No | Sí, con fuente de OBS y !coach |
| Minijuegos o puzles | No | Sí («Porofessor Arcade») | No | No | Concursos | Test de personalidad | No |
| **Monetización** | | | | | | | |
| Modelo | Gratis con anuncios; Premium sin anuncios + builds de Maestro+ y OTP (la página muestra «--» de precio) | Gratis con anuncios (s/c) | Gratis; Plus «desde 4,99 $ al mes» (s/c, dato de buscador) | Gratis; PLUS 3,99 $ al mes o 29,88 $ al año | Gratis; suscripción a una voz de IA, que también quita los anuncios (precio no publicado) | Gratis; iTero+ 7,99 $ al mes (est. 22-10; itero.gg no da el precio) | **Todo gratis y de código abierto, sin anuncios** |

## 2. Las 15 mejoras que más nos acercan a Blitz

Pensadas para un jugador medio hispanohablante (Plata-Esmeralda, una o dos colas, poco tiempo). Se excluyen las tres que ya están en curso: % de fase de líneas, % de bans y picks, y sinergias.

Ordenadas por **impacto / esfuerzo**. Esfuerzo: **S** (1-2 días) · **M** (3-7 días) · **L** (más de una semana).

Claves de datos:
- **Local**: LCU o Live Client Data API; no gasta clave.
- **Ya rastreado**: sale de las partidas que el servidor ya agrega, sin llamadas nuevas.
- **Desarrollo**: cabe en la clave de desarrollo, pero recuerda que no se puede usar en un producto público.
- **Producción**: necesita la clave de producción.

### 1. Sugerencias de baneo en la selección · S
- **Qué es:** en la fase de bans, de 3 a 5 opciones de ban para tu campeón o rol: los counters que más te cuestan y los más fuertes del parche, con el motivo de cada uno.
- **Cómo lo hacen ellos:** OP.GG lo anuncia como «Pick-and-ban recommendations» en [op.gg/desktop](https://op.gg/desktop) y U.GG como «Champion Select Scouting… best picks & counters» en [u.gg/app](https://u.gg/app). De Porofessor solo lo dicen terceros (s/c).
- **Datos:** ya rastreado: counters (3.9), % de bans (en curso) y tier.
- **Norma:** se cumple si damos varias opciones. La política dice: «Products should not remove game decisions» y permite resaltar decisiones y ofrecer varias opciones ([docs/lol](https://developer.riotgames.com/docs/lol)). Nunca debe ser un «banea X».

### 2. Arena y ARAM: Caos con % de uso, posición media y top 4 · S
- **Qué es:** en cada aumento y objeto de Arena, su % de uso con ese campeón. En el campeón: posición media, % de primer puesto y % de top 4. **Ningún % de victorias.**
- **Cómo lo hacen ellos:** Blitz enseña «Avg. Place 3.3 · 1st Place 19% · Top 4 71%» y «PR» en cada aumento y objeto ([blitz.gg/lol/champions/ahri/arena](https://blitz.gg/lol/champions/ahri/arena)). En Caos ordena los aumentos por niveles ([…/aram-mayhem](https://blitz.gg/lol/champions/ahri/aram-mayhem)).
- **Datos:** ya rastreado. El servidor ya reúne partidas de Arena y Caos; solo hay que contar las veces que se elige cada aumento.
- **Norma:** la prohibición solo cubre el % de victorias: «Products cannot display win rates for Augments or Arena Mode items. This applies to all websites, applications and overlays» ([docs/lol](https://developer.riotgames.com/docs/lol)).
- ⚠️ Matiz: el «top 4» de un **aumento** podría verse como un % de victorias encubierto. Por eso el top 4 y la posición media van solo en el **campeón**, y en el aumento únicamente el % de uso, igual que Blitz.

### 3. Aviso de «power spike» del rival de línea · S-M
- **Qué es:** por voz y en el overlay: «Tu rival ha terminado Zhonya: no entres con la definitiva». Sale cuando un enemigo completa un objeto clave.
- **Cómo lo hacen ellos:** Mobalytics anuncia «powerspike notifications» en [mobalytics.gg/download](https://mobalytics.gg/download). OP.GG lo da por voz: «Enemy Xerath just finished Zhonya's» ([op.gg/ai](https://op.gg/ai)).
- **Datos:** local. `allgamedata` de la Live Client Data API trae los objetos de todos los jugadores, lo mismo que el jugador ve en el Tab.
- **Norma:** solo usa información que el jugador puede ver al pulsar Tab. **No** hay que copiar los avisos de OP.GG sobre recalls enemigos o guardianes de control en el río. No hemos comprobado de dónde los saca, y pueden chocar con «Products may not provide any game-session-specific information that would be previously unknown to the player» ([docs/lol](https://developer.riotgames.com/docs/lol)).

### 4. Ficha del campeón: claves, fortalezas, debilidades, parecidos y desglose de daño · S
- **Qué es:** en la vista Campeón y en la selección, cuatro bloques cortos en español: «Información clave», «Fortalezas», «Debilidades» y «Campeones parecidos». Además, la barra de daño (por ejemplo, 72 % AP · 21 % verdadero).
- **Cómo lo hacen ellos:** Blitz tiene «Key Insights», «Strengths», «Weaknesses», «Similar Champions» y «Damage Breakdown» ([blitz.gg/lol/champions/ahri/build](https://blitz.gg/lol/champions/ahri/build)). Mobalytics tiene «Tips and tricks» ([mobalytics.gg/lol/champions/ahri/build](https://mobalytics.gg/lol/champions/ahri/build)).
- **Datos:**
  - los textos se generan una vez con la IA del servidor a partir de Data Dragon y se revisan; no usan la API de Riot;
  - el daño sale de los campos de daño físico, mágico y verdadero de MATCH-V5, ya rastreados.
- **Norma:** sin problema; es información estática.

### 5. Tier y cambio respecto al parche anterior, a la vista · S
- **Qué es:** junto al % de victorias, una flecha con el cambio (+0,4 %) y el tier en la cabecera del campeón, en la tier list y en la selección.
- **Cómo lo hacen ellos:** Blitz enseña «Win Rate Change +0.4%» en la build. OP.GG tiene una pestaña «Trends» ([op.gg/lol/champions/ahri/build](https://www.op.gg/lol/champions/ahri/build)).
- **Datos:** ya rastreado. El servidor ya guarda el parche anterior (cadena «También se usan datos del parche anterior»).
- **Norma:** sin problema.

### 6. Puesto del 1.º al 10.º en la partida, con MVP y ACE · S
- **Qué es:** sobre nuestras notas de 0 a 100, ordenar a los 10 jugadores. MVP para el mejor del equipo ganador y ACE para el mejor del perdedor. Al jugador se le dice «Has sido 3.º de 10».
- **Cómo lo hacen ellos:** Mobalytics: «Post Game reports give you a 1st-10th ranking» ([mobalytics.gg/download](https://mobalytics.gg/download)). OP.GG: OP Score de 0 a 10 con MVP y ACE ([centro de ayuda de OP.GG](https://help.op.gg/hc/en-us/articles/31088715328665-OP-Score-explained), visto solo en el resultado del buscador: s/c).
- **Datos:** local, con las estadísticas de fin de partida de la LCU.
- **Norma:** es una nota de **una partida**, no una clasificación alternativa. No hay que acumularla en una «liga» ni en un número tipo MMR: «Products cannot create alternatives for official skill ranking systems… Prohibited alternatives include MMR or ELO calculators» ([policies/general](https://developer.riotgames.com/policies/general)). Las etiquetas de los demás jugadores, siempre positivas o neutras, como hasta ahora.

### 7. Temporizadores de reliquias de vida en ARAM · S
- **Qué es:** en ARAM y Caos, cuatro círculos con la cuenta atrás de cada reliquia, que se marcan con un atajo, igual que la jungla manual.
- **Cómo lo hacen ellos:** Blitz tiene el «Overlay de temporizadores de vida en ARAM» ([blitz.gg/lol/overlays](https://blitz.gg/lol/overlays)). iTero también lo tiene (est. 22-10).
- **Datos:** local y a mano. La Live Client Data API no tiene ningún evento de reliquia (est. 22-10).
- **Norma:** se cumple. Es lo que el jugador ve y apunta, sin datos ocultos.

### 8. Counters personales y tier list personal, gratis · M
- **Qué es:** «Contra quién te va mal a ti» y «tus mejores campeones por rol», a partir de tu historial (mínimo de partidas y aviso de «pocas partidas»). En la selección, junto a los counters generales.
- **Cómo lo hacen ellos:** U.GG lo cobra en PLUS: «Personal Counters & Stats», «Personal Tier List» ([u.gg/plus](https://u.gg/plus); en la build sale bloqueado como «PLUS Personal Counters»). iTero tiene la tier list personal (est. 22-10).
- **Datos:** local. El historial de la LCU y los perfiles por cuenta que ya guardamos.
- **Norma:** sin problema; son datos del propio jugador. Mensaje de venta: «lo que en U.GG es de pago, aquí es gratis».

### 9. Notas del parche resumidas en español, con «lo que cambia para tus campeones» · S-M
- **Qué es:** cada parche, un resumen corto y la lista de cambios que afectan a tus 5 campeones más jugados y a tus objetos. Se puede leer o escuchar.
- **Cómo lo hacen ellos:** Blitz tiene la sección «Noticias» ([blitz.gg/lol/tierlist](https://blitz.gg/lol/tierlist), menú). OP.GG enlaza a las notas del parche ([op.gg/lol/champions/ahri/build](https://www.op.gg/lol/champions/ahri/build)).
- **Datos:** las notas públicas de Riot y Data Dragon. No usa la API de juego.
- **Norma:** sin problema. Hay que enlazar siempre a la fuente oficial y no copiarla entera.

### 10. Resumen automático de cada partida en tu Discord · M
- **Qué es:** el usuario pega un webhook de su servidor y, al acabar, se publica su tarjeta (nota, KDA, reto). Opcionalmente, una clasificación de su grupo de amigos con **sus propias** notas.
- **Cómo lo hacen ellos:** U.GG PLUS: «Get automatic post-match summaries and a server leaderboard for up to 12 players» ([u.gg/plus](https://u.gg/plus)).
- **Datos:** local, con la tarjeta compartible que ya existe.
- **Norma:**
  - solo datos del jugador que lo activa, nunca nombres de los demás, igual que la tarjeta actual;
  - la clasificación de amigos con notas propias, nunca como alternativa al ladder.

### 11. Tiempos objetivo de los objetos · M
- **Qué es:** «Objeto 1 hacia el minuto 11, botas a los 14». En la build, y por voz en partida si vas tarde («llevas 2 minutos de retraso en tu primer objeto»).
- **Cómo lo hacen ellos:** Mobalytics: «Time Target… @ 10 sec / @ 3 min / @ 20 min» ([mobalytics.gg/lol/champions/ahri/build](https://mobalytics.gg/lol/champions/ahri/build)).
- **Datos:** necesita el **timeline** de MATCH-V5 (minuto de cada compra). Es una llamada extra por partida rastreada, así que con la clave de desarrollo apenas da para una muestra. **Producción** para hacerlo bien.
- **Norma:** sin problema; es un dato agregado anterior a la partida.

### 12. Combos y consejos del enfrentamiento en la tarjeta «Contra {rival}» · M
- **Qué es:** 2 o 3 combos del campeón en texto con iconos (por ejemplo, E → Q → W → R) y 3 consejos para ese cruce concreto, en la tarjeta de enfrentamiento de la 3.9 y por voz al cargar.
- **Cómo lo hacen ellos:**
  - Mobalytics tiene la pestaña «Combos» y el «Expert Video Guide» ([mobalytics.gg/lol/champions/ahri/build](https://mobalytics.gg/lol/champions/ahri/build));
  - su Plus vende «Matchup Specific Advice» (dato de buscador, s/c);
  - OP.GG da un análisis del enfrentamiento por voz en el minuto 1:10 ([op.gg/ai](https://op.gg/ai)).
- **Datos:** IA del servidor sobre Data Dragon, más nuestros counters. No usa la API de juego.
- **Norma:** sin problema, siempre que sean consejos y no órdenes.

### 13. Rendimiento por objeto (Grieta) · M
- **Qué es:** para cada objeto del campeón, su % de uso, su % de victorias y la diferencia frente a no hacerlo. **Nunca en Arena.**
- **Cómo lo hacen ellos:**
  - Blitz: «Item Performance» con creador de builds y uso mínimo ([blitz.gg/lol/champions/ahri/build](https://blitz.gg/lol/champions/ahri/build));
  - U.GG: opciones del 4.º, 5.º y 6.º objeto con su % ([u.gg/lol/champions/ahri/build](https://u.gg/lol/champions/ahri/build));
  - OP.GG: «Depth 4/5/6».
- **Datos:** ya rastreado, pero con la muestra actual habrá pocos objetos fiables. Con «datos limitados» ahora y bien con **producción**.
- **Norma:** permitido en la Grieta. En Arena está prohibido («win rates for… Arena Mode items»).

### 14. Preguntar al coach en voz alta durante la partida · L
- **Qué es:** pulsar una tecla y preguntar «¿qué me compro contra Malphite?». Responde la voz en español con el contexto de la partida.
- **Cómo lo hacen ellos:** OP.GG: «Ask anything by voice while you play. The AI answers in real time» ([op.gg/ai](https://op.gg/ai)).
- **Datos:**
  - local (Live Client Data API) más nuestra IA del servidor;
  - el reconocimiento de voz, mejor sin conexión (Whisper o similar), para mantener el «sin conexión» de la voz.
- **Norma:** sin problema, mientras la respuesta use solo información visible y dé opciones. La tecla solo se registra en partida, como ahora.

### 15. Filtros de rango y región, y builds de profesionales y one-tricks · L
- **Qué es:**
  - poder elegir «Oro», «Platino»… y la región (EUW, LAN, LAS);
  - una pestaña con las últimas partidas de pros y de los mejores one-tricks hispanohablantes.
- **Cómo lo hacen ellos:**
  - OP.GG tiene 14 rangos y 16 servidores ([op.gg/lol/champions/ahri/build](https://www.op.gg/lol/champions/ahri/build));
  - Blitz tiene «Pro Builds» con cuentas de EUW, KR, NA y BR ([blitz.gg/lol/champions/ahri/build](https://blitz.gg/lol/champions/ahri/build)) y cobra el OTP en Premium ([blitz.gg/premium](https://blitz.gg/premium)).
- **Datos:** **producción**. Cada rango multiplica las llamadas, y seguir cuentas exige partidas recientes de cada una.
- **Norma:** las estadísticas agregadas están permitidas («Aggregate player stats are approved when they don't target specific players», según la lectura de [docs/lol](https://developer.riotgames.com/docs/lol); resumen, no literal). Las cuentas de pros son públicas y visibles, sin desanonimizar a nadie.

**Siguiente después de estas 15:** un buscador de perfiles con «Live Game» (Porofessor y U.GG) y un asistente de draft con IA (iTero). Los dos necesitan producción y son L.

### Normas de Riot por fase (resumen para el equipo)

| Fase | Permitido (con cita) | Prohibido (con cita) |
|---|---|---|
| Selección | Destacar decisiones y dar **varias opciones** («They may highlight important decisions and offer multiple choices», resumen de [docs/lol](https://developer.riotgames.com/docs/lol)); importar builds con la LCU, aunque Riot avisa: «This service is not officially supported for use with third party applications» | «Apps that dictate player decisions»; reducir la variedad: «Products should increase, and not decrease the diversity of game decisions» |
| Carga | Rango oficial y datos agregados de los visibles | «Products cannot identify or analyze players who are deliberately hidden by the game»; «Products cannot de-anonymize players…»; MMR o ELO; **anuncios**: «You may not place advertisements in Riot properties, which include in-game, loading screens, and the Riot Client» |
| Partida | Lo que da la Live Client Data API y lo que el jugador ve | «Products must not use or incorporate information not present in the game client that would give players a competitive edge» (el ejemplo de Riot son los cooldowns de definitivas enemigas); «Products may not provide any game-session-specific information that would be previously unknown to the player»; leer la memoria (bloqueada desde el 6-10-2026) |
| Post-partida y modos | Analizar tus propias partidas; niveles y % de uso de aumentos | «Products cannot display win rates for Augments or Arena Mode items»; publicar el historial de personalizadas de otros sin que lo acepten |
| Monetización | «You must have a free tier of access for players»; cobrar solo por contenido «transformative»; registrar el producto | Apuestas («cannot feature betting or gambling») y anuncios dentro del juego, la carga o el cliente |
| Clave | Producción para un producto público | «You may not maintain a public product with a development API key» ([docs/portal](https://developer.riotgames.com/docs/portal)) |

Nota: en la lista de «casos aprobados» del portal sale «Game overlays that provide static data that is available prior to the game». No dice que los overlays con datos en directo estén prohibidos, y Riot ofrece la Live Client Data API justo para eso. Aun así, conviene describir el overlay con cuidado en la solicitud de producción (s/c cómo lo interpreta Riot al revisarla).

## 3. Dónde ya les ganamos o podemos ganarles

| Ventaja | Estado frente a ellos | Cómo explotarla |
|---|---|---|
| **Coach por voz en español, sin conexión y gratis** | Solo OP.GG tiene voz con IA. No consta en español, y las voces de creadores son de pago | Ponerlo en primer plano: «el único coach por voz en español de España y Latinoamérica, gratis y sin internet». Grabar un clip de 30 s para TikTok o Shorts con la voz en partida. Ofrecer voces de streamers hispanos (con permiso y paquete pregrabado, que ya está previsto en el código) como respuesta gratuita a las voces de pago de OP.GG |
| **Análisis con IA gratis al terminar** | iTero lo cobra (macro 🔒); Blitz, U.GG y OP.GG no tienen análisis en texto | Mostrarlo en la tarjeta compartible («Mi coach dice: …») y en el resumen de Discord (mejora 10) |
| **Retos de 7 días con voz** | Solo Mobalytics («Challenges») y Game Coach AI («Reps») tienen algo parecido; ninguno en español | Retos de comunidad semanales en el Discord oficial («esta semana: visión») con clasificación de participación, nunca de nivel |
| **Todo gratis, sin anuncios y de código abierto** | Todos los demás tienen anuncios y una versión de pago (U.GG PLUS desde 2,49 $ al mes; Blitz Premium; OP.GG con voz de pago; iTero+) | Una tabla «Lo que ellos cobran y aquí es gratis»: counters personales, tier list personal, builds de alto elo, análisis con IA, Discord. Destacar que el código está en GitHub y que no lee memoria: con el bloqueo del 6-10-2026, «no te va a dejar de funcionar» |
| **Sin memoria del juego** | Las definitivas de los aliados (Blitz, iTero) y el rastreador de daño (iTero) pueden depender de ella; el plazo acaba en abril de 2027 | Dejar claro en la web y en la solicitud de producción que solo usamos API oficiales (ya está en el README, «Qué no hace») |
| **Modos rotativos y Caos con builds propias y combos de aumentos** | Blitz y OP.GG cubren muchos modos; los combos de aumentos no los hemos visto en nadie | Añadir el % de uso del aumento (mejora 2) para igualar a Blitz sin salirnos de la norma |
| **Modo streamer con fuente de OBS y !coach** | OP.GG tiene «Streamer Overlay» aparte; Blitz s/c | Ofrecerlo a streamers hispanos pequeños como «overlay gratis con subtítulos del coach» |
| **Hecho en español, no traducido** | La web de Blitz en español deja la build en inglés; U.GG no tiene español visible | Usar términos de la comunidad hispana y voz con acento a elegir (s/c si ya se puede elegir variante de voz) |

## 4. Fuentes abiertas de verdad (25-10-2026)

Abiertas en el navegador integrado (texto leído):
- https://blitz.gg/lol/champions/ahri/build (redirige a /build/mid)
- https://blitz.gg/lol/champions/ahri/counters
- https://blitz.gg/lol/champions/ahri/aram-mayhem
- https://blitz.gg/lol/champions/ahri/arena
- https://blitz.gg/lol/champions/ahri/synergies
- https://blitz.gg/lol/champions/ahri/one-tricks (404)
- https://blitz.gg/lol/aram-mayhem (404)
- https://blitz.gg/lol/tierlist
- https://blitz.gg/lol/overlays
- https://blitz.gg/premium
- https://u.gg/lol/champions/ahri/build
- https://u.gg/app
- https://u.gg/plus
- https://mobalytics.gg/lol/champions/ahri/build
- https://mobalytics.gg/download (redirige a /lol/glp/app-download)
- https://porofessor.gg/ (portada con partidas destacadas; /es/ quedó tras el reto de Cloudflare, que no se ha intentado saltar)
- https://op.gg/desktop (/desktop/en)
- https://op.gg/ai
- https://op.gg/lol/summoners/euw/Agurin-EUW (no cargó texto; no se usa)
- https://go.overwolf.com/porofessor y https://go.overwolf.com/porofessor-up/ (404)
- https://www.overwolf.com/app/Porofessor.gg-Porofessor.gg (página vacía)

Leídas con WebFetch:
- https://developer.riotgames.com/policies/general
- https://developer.riotgames.com/docs/lol
- https://developer.riotgames.com/docs/portal
- https://support.riotgames.com/ar-ae/riot/performance/game-memory-access-removed-for-third-party-apps
- https://www.op.gg/lol/champions/ahri/build
- https://lolalytics.com/lol/ahri/build/
- https://itero.gg
- https://wecoach.gg/blog/article/all-you-need-to-know-about-porofessorgg-a-complete-guide (fuente de terceros y poco fiable; solo apoyo)
- Bloqueadas con 403: blitz.gg/app, u.gg (WebFetch), mobalytics.gg (WebFetch), metasrc.com/lol

Solo vistas como resultado de buscador (no abiertas, tratadas como s/c): el centro de ayuda de OP.GG sobre el OP Score, mobalytics.gg/tft/glp/plus (precio de Plus), la reseña de freedom251.com sobre el precio de Blitz Premium, la ficha de Overwolf de iTero y la nota de prensa de iTero Standalone.

Documento interno: `docs/competencia-blitz-itero-gamecoach.md` (estudio con las apps instaladas, 22-10-2026), `CHANGELOG.md`, `README.md` y `app/src/shared/i18n/es.json`.
