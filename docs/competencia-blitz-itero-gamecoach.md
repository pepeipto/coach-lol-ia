# Competencia: Blitz, iTero y Game Coach AI frente a Coach LoL IA

Revisado el 2026-10-22 con las tres apps instaladas en el PC y la cuenta akira88#lol: Blitz, The iTero Coach (iTero+) y Game Coach AI.

- League of Legends **no estaba abierto**: se comprobó con `Get-Process` y no había ningún proceso `League of Legends`, `LeagueClient`, `LeagueClientUx` ni `RiotClientServices`. Por eso los overlays se han revisado en las pantallas de configuración y en sus vistas previas, no en una partida real.
- Coach LoL IA se ha revisado en la versión 3.4.0 (`app/src` y `server/src`, commit `1995dc3`).

## 1. Qué ofrece cada app

### Blitz (gratis, con anuncios; Premium opcional)

- **Perfil:** rango Solo/Flex con su % de victorias, gráfica e historial de PL, rango en ARAM y ARAM: Caos, rendimiento por campeón y «Grupo de campeones».
- **Historial:** cada partida muestra KDA, CS/min, oro por minuto, objetos, runas y los 10 jugadores. Lleva etiquetas automáticas como «MVP», «Asquerosamente rico», «Daño superior» o «2-Pieces».
- **Post-partida:**
  - repetición del minimapa («Analizando partida»);
  - puntuaciones de **Combate** y **Farmeo** sobre 100 comparadas con un rango que eliges («vs Oro»);
  - logros como «Primer golpe», «Reembolso» o «Manitas»;
  - pestañas Resumen, Estadísticas, **Línea de tiempo** (kills, guardianes, torres), **Gráficos** (daño, daño recibido, CS, oro, nivel y ventaja de oro del equipo) y **Probabilidad de victoria minuto a minuto**.
- **Campeones (estadísticas):** tabla con nivel, % de victorias, su cambio respecto al parche anterior, % de bans, % de picks y número de partidas. Se puede filtrar por rango, región y parche, y hay pestañas de Solo/Duo, League Classic, maestría, sinergias, ARAM, URF, Arena y Arena 2v2.
- **Página de un campeón:**
  - pestañas Build, ARAM: Caos, Clásico, ARAM, URF, Arena, **Pro Builds**, **One Tricks**, **Counters**, **Sinergias** y Habilidades;
  - filtros de rol, rango, región, **enfrentamiento** y parche;
  - tres builds (Mejor, % de victorias y Común), la build de un one-trick (OTP) y builds de profesionales (Faker, etc.);
  - runas, hechizos, orden de habilidades, objetos iniciales, núcleo y situacionales, y el reparto del daño (90 % AP);
  - **tabla de rendimiento de cada objeto**: diferencia de victorias, % de victorias antes de comprarlo, % de victorias y % de picks;
  - creador de builds, «Información clave», fortalezas, debilidades y campeones similares.
- **Counters:** tres columnas con una puntuación de counter, el % de victorias en la partida y el % de victorias en la fase de líneas contra cada rival, con su número de partidas.
- **ARAM: Caos y Arena:** aumentos ordenados por **niveles** (prismático, oro, plata) con su descripción, **sin % de victorias**. En la tier list de Arena, los campeones sí llevan su %.
- **Otras secciones:** noticias y notas de parche, y League Classic.
- **Ajustes de LoL:**
  - importar runas, objetos y hechizos automáticamente, elegir en qué tecla va Destello e importar maestrías (Classic);
  - «Enfocar Blitz durante la selección de campeón»;
  - una tarjeta para presumir de tus estadísticas tras ARAM: Caos o Arena.
- **12 overlays:**
  - avisos de objetivos (Barón y Dragón con cuenta atrás);
  - temporizadores de las reliquias de vida en ARAM;
  - niveles de los aumentos de ARAM: Caos y Arena al elegirlos;
  - comparativa de rendimiento (CS/min frente al rival en directo);
  - ruta de jungla;
  - diferencia de valor de los objetos entre jugadores;
  - pantalla de carga;
  - temporizadores del minimapa (campamentos e inhibidores);
  - orden de habilidades recomendado;
  - recordatorio de baratija;
  - definitivas de los aliados;
  - una «Nueva experiencia de overlay» en pruebas.

### iTero / The iTero Coach (gratis con anuncios; iTero+ por 7,99 $ al mes)

- **Perfil:** historial con una **«Puntuación de draft»** en cada partida y un «AI Macro Score» (de pago), gráfica de PL, últimas 10 partidas, estadísticas de la cuenta y de cada campeón.
- **Post-partida:**
  - etiquetas por jugador («Carry», «Tanque», «Arrasado por el jungla»…);
  - desglose del KDA, CS/min, diferencia de monstruos épicos, daño recibido y daño infligido, cada uno con su **percentil en la partida** («Lowest 47th»);
  - gráfica de oro con los objetivos marcados en el tiempo;
  - pestaña **Draft** con el rango medio de la sala y una puntuación de counter y de sinergia por jugador;
  - pestaña «Entrenador de macro» (de pago).
- **Entrenador de macro:** una nota por fase de la partida (0-7, 7-14, 14-21, 21-28 y 28+ min), estadísticas frente a la media de tu elo con su percentil, media móvil de 50 partidas, «Puntos fuertes» y «Principales áreas de mejora».
- **Tier list:** general o **personal** (con tus campeones), con filtros por rango y rol y un deslizador de % de picks.
- **Herramientas:**
  - **simulador de draft** con «Obtener recomendaciones» y «Personalización del modelo»;
  - **constructor de champion pool** con IA;
  - un test de personalidad que te recomienda campeones.
- **Ajustes de draft:** maestría combinada de varias cuentas (de pago), tener en cuenta los campeones que marcan tus aliados, enviar la build al cliente y cargar automáticamente la primera recomendada.
- **Overlays**, que se muestran mientras mantienes pulsado Tab:
  - temporizadores del mapa en la Grieta (campamentos, monstruos neutrales e inhibidores) y en ARAM (reliquias de vida, inhibidores y torres del Nexo);
  - valor en oro de los objetos;
  - **rastreador de oro del equipo** por línea;
  - **rastreador de daño** (físico, mágico y verdadero; infligido y recibido);
  - buffs de Barón y Anciano con su duración;
  - **definitivas de los aliados**;
  - **CS/min frente a la media de tu elo** en el enfrentamiento;
  - orden de habilidades («LEVEL UP! +1»);
  - nivel de los aumentos de ARAM: Caos;
  - temporizador de hechizos de invocador, que se marcan a mano.
- **iTero+:** sin anuncios, revisión del coach de macro con IA, análisis continuo del draft, análisis rápido «FastTrack» y la posibilidad de añadir cualquier cuenta.

### Game Coach AI (gratis; plan «Upgrade» de pago)

- **Coach de voz en partida:**
  - la pantalla principal dice «Ready to coach / Waiting for the League of Legends game to launch»;
  - se puede elegir el idioma de la voz, y Ctrl+Alt+M la silencia.
- **«Live Game Scout»:** un overlay que aparece al empezar la partida (y se quita con Tab).
- **Dashboard:**
  - gráfica de PL, % de victorias, últimas 10 partidas y campeones o roles más jugados;
  - tarjetas de tendencia de **CS/min, diferencia de oro a los 14 min, participación en asesinatos (KP) y muertes por partida**, con su cambio y filtro por rol.
- **«Reps»:** retos de práctica, uno activo cada vez, con racha y las últimas partidas. El catálogo trae 16:
  - Carry (cuota de daño), Farm up early (CS a los 10 min), Hold your own (diferencia de oro y de XP a los 14 min), Stay alive y Ward up;
  - Win the 1v1, Clean lane phase, Gank them all, Hit your farm, Own the map's eyes y Show up (≥50 % de KP);
  - Take the plates, Be there (KP en objetivos), Make it happen, Make roams pay y Sweep (guardianes destruidos).
- **Partidas:**
  - **«Snapshot @14» frente a tu rival de línea**, con la diferencia de XP, oro, CS y KP y la etiqueta «Lane won»;
  - MVP y pestañas Summary, Lane focus, Runes/Build y Damage.

## 2. Tabla de funciones frente a Coach LoL IA

✅ = lo tiene · ◐ = lo tiene en parte · ❌ = no lo tiene · 🔒 = de pago

| Función | Blitz | iTero | Game Coach AI | Coach LoL IA 3.4 (dónde está) |
|---|---|---|---|---|
| **Selección de campeón** | | | | |
| Importar runas, hechizos y objetos | ✅ automático | ✅ | ❌ | ✅ manual o automático (`app/src/main/lcu/importar.ts`, `builds/clienteBuilds.ts`) |
| Varias builds por campeón y rol | ✅ 3 + OTP + pro | ✅ | ❌ | ✅ 3 opciones y varias páginas de runas (`TarjetaBuild.tsx`, `SelectorRunas.tsx`) |
| Filtros de rango, región y parche | ✅ | ✅ | ❌ | ❌ solo Esmeralda+ en EUW, LAN y LAS (`server/src/config.ts`) |
| Counters y enfrentamientos | ✅ | ◐ (puntuación en el draft) | ❌ | ❌ |
| Sinergias | ✅ | ◐ | ❌ | ❌ |
| Recomendación de pick o draft | ❌ | ✅ (IA, simulador) | ❌ | ❌ |
| Builds de pros y one-tricks | ✅ | ❌ | ❌ | ❌ |
| Rendimiento por objeto | ✅ | ❌ | ❌ | ❌ |
| Información clave, fortalezas y debilidades | ✅ | ❌ | ❌ | ❌ |
| Abrir la app sola al bloquear el campeón | ✅ | ✅ | — | ◐ hay vigilante de selección (`lcu/vigilante.ts`, `orquestador/seleccion.ts`) |
| **Tier lists** | | | | |
| Tier list por rol | ✅ | ✅ (+ personal) | ❌ | ✅ S/A/B/C por rol (`VistaCampeones.tsx`, `listaCampeones.ts`) |
| ARAM, ARAM: Caos y Arena | ✅ | ◐ | ❌ | ✅ con builds propias (`TarjetasModo.tsx`) |
| Niveles de aumentos (sin %) | ✅ | ✅ | ❌ | ✅ 3.4 (`consejos/aumentosCaos.ts`, `datos/aumentosCaos.json`) |
| Cambio de % respecto al parche anterior | ✅ | ❌ | ❌ | ❌ |
| **Perfil** | | | | |
| Rango y % de victorias | ✅ | ✅ | ✅ | ❌ (solo en la pantalla de carga) |
| Historial de partidas | ✅ | ✅ | ✅ | ❌ |
| Gráfica de PL | ✅ | ✅ | ✅ | ❌ |
| Rendimiento por campeón | ✅ | ✅ | ✅ | ❌ |
| Tendencias y KPIs (CS/min, oro a los 14, KP, muertes) | ◐ | ✅ (coach de macro) | ✅ | ❌ |
| Retos o metas de práctica | ❌ | ◐ («áreas de mejora») | ✅ («Reps») | ❌ |
| **Post-partida** | | | | |
| Resumen con los 10 jugadores | ✅ | ✅ | ✅ | ◐ el análisis con IA usa la LCU, sin tabla (`ia/coachIa.ts`, `VistaAnalisis.tsx`) |
| Análisis con IA en texto | ❌ | 🔒 | ◐ | ✅ 3.3: bien, a mejorar y momentos clave (`ia/resumen.ts`, `server/src/coachIa/`) |
| Puntuaciones (combate, farmeo, draft) | ✅ | ✅ | ◐ | ❌ |
| Etiquetas (MVP, carry…) | ✅ | ✅ | ✅ | ❌ |
| Línea de tiempo | ✅ | ◐ | ❌ | ◐ momentos clave de la IA (`ia/momentos.ts`) |
| Gráficas de oro, daño, CS y nivel | ✅ | ✅ | ❌ | ❌ |
| Probabilidad de victoria por minuto | ✅ | ❌ | ❌ | ❌ |
| Foto a los 14 min frente al rival | ❌ | ❌ | ✅ | ❌ |
| **Pantalla de carga** | | | | |
| Rango, maestría y etiquetas | ✅ | ❌ | ✅ (Live Game Scout) | ✅ con etiquetas positivas o neutras, sin jugadores ocultos (`overlay/carga/`, `server/src/jugadores/`) |
| **Overlays en partida** | | | | |
| Objetivos (Dragón y Barón) | ✅ | ✅ | ◐ (voz) | ✅ con el tipo del próximo dragón (`BarraObjetivos.tsx`, `consejos/objetivos.ts`) |
| Habilidad que toca subir | ✅ | ✅ | ❌ | ✅ flecha sobre el HUD (`FlechaHabilidad.tsx`) |
| CS/min frente a una media | ✅ | ✅ (por elo) | ❌ | ✅ CS y KDA frente a la media del campeón en su rol (`WidgetCs.tsx`) |
| Temporizadores de jungla | ✅ | ✅ | ❌ | ✅ manuales y en el minimapa (`MinimapaJungla.tsx`, `atajosJungla.ts`) |
| Inhibidores y reliquias de ARAM | ✅ | ✅ | ❌ | ❌ |
| Ruta de jungla | ✅ | ❌ | ❌ | ◐ ruta del jungla enemigo estimada y opcional (`junglaEnemiga.ts`, `server/src/rutaJungla.ts`) |
| Diferencia de oro o valor de objetos | ✅ | ✅ | ❌ | ❌ |
| Rastreador de daño | ❌ | ✅ | ❌ | ❌ |
| Buffs de Barón y Anciano | ❌ | ✅ | ❌ | ❌ |
| Definitivas de los aliados | ✅ | ✅ | ❌ | ❌ |
| Recordatorio de baratija | ✅ | ❌ | ❌ | ❌ |
| Aviso de compra | ❌ | ❌ | ◐ | ✅ (`ToastCompra.tsx`) |
| Coach de voz | ❌ | ❌ | ✅ | ✅ 460 frases y voz neuronal sin conexión en 5 idiomas (`main/voz/`, `consejos/voz.ts`) |
| Consejos con IA en partida | ❌ | ❌ | ✅ | ✅ 3.3, en los momentos muertos (`ia/coachIa.ts`) |
| **Otros** | | | | |
| Noticias y parches | ✅ | ❌ | ❌ | ◐ novedades de la app (`VistaNovedades.tsx`) |
| Asistente de ayuda con IA | ❌ | ❌ | ❌ | ✅ (`server/src/asistente/`) |
| Idiomas | muchos | muchos | inglés | 5 (`shared/i18n/`) |
| Precio | gratis + Premium | gratis + 7,99 $ al mes | gratis + Upgrade | **todo gratis** |

**Resumen:**
- Coach LoL IA está a la altura, o por delante, en **voz, IA y overlays básicos**.
- Donde más se queda atrás es en tres bloques: **perfil e historial**, **post-partida con gráficas** y **datos de estadísticas** (counters, filtros de rango y parche, rendimiento por objeto, pros y one-tricks).

## 3. Qué se puede hacer con cada tipo de clave de Riot

### Los tres tipos de clave y las fuentes de datos

- **Clave de desarrollo:**
  - Límites: 20 peticiones por segundo y 100 cada 2 minutos.
  - **Caduca cada 24 h.**
  - Según las reglas del Discord oficial de desarrolladores (#rules-faq), *no se puede usar en un producto público*, ni siquiera en una beta abierta. Riot puede bloquear la clave y denegar después la de producción.
- **Clave personal:**
  - Mismos límites que la de desarrollo, pero **no caduca**.
  - Es solo para uso privado del desarrollador o de un grupo pequeño. Tampoco vale para un producto público.
  - El portal da el mismo error al pedirla, así que ahora mismo tampoco se puede conseguir.
- **Clave de producción:**
  - Empieza en 500 peticiones cada 10 s y 30 000 cada 10 min, por región.
  - Es la única válida para una app pública.
- **Datos locales, que no gastan ninguna clave:** la **LCU** del cliente (selección, historial y estadísticas de fin de partida del propio jugador) y la **Live Client Data API** (`127.0.0.1:2999`, lo que se ve en el Tab). La política de Riot se aplica igual.
  - El 6-10-2026 Riot **prohibió el acceso a la memoria del juego** para las apps de terceros; las ya existentes pueden pedir una prórroga hasta abril de 2027. Varios overlays de la competencia que dependen de ella (definitivas de los aliados, daño) podrían desaparecer o cambiar.
  - En #lol-dev se comenta que Riot ha empezado a limitar las peticiones a la LCU (parches 26.20 y 26.21, repeticiones). Conviene que Coach LoL IA no abuse de ella.

### Qué datos dependen de qué clave

| Dato | ¿Sale de la API de Riot? | Desarrollo o personal | Producción | Comentario |
|---|---|---|---|---|
| Overlays de partida (objetivos, temporizadores, CS, oro visible en el Tab, baratija, habilidad) | No, sale de la Live Client Data API | ✅ | ✅ | No gastan clave. Solo la media de referencia viene del servidor |
| Valor en oro de los objetos por línea | No (objetos visibles en el Tab) | ✅ | ✅ | Política: solo lo que el jugador ya puede ver |
| Inhibidores | No (evento `InhibKilled` más 5 min) | ✅ | ✅ | Es información que el jugador conoce |
| Reliquias de ARAM | No (no hay evento) | ◐ a mano | ◐ a mano | Igual que los temporizadores de jungla manuales |
| Definitivas de los aliados y rastreador de daño | No (la Live Client Data API no los da) | ❌ | ❌ | Solo con lectura de memoria, que **ya no está permitida** |
| Historial, rango y estadísticas de fin de partida **del jugador local** | No (LCU) | ✅ | ✅ | Perfil y post-partida sin gastar clave |
| Gráfica de PL | No (se guarda una foto del rango en cada partida) | ✅ | ✅ | Riot no da el historial de PL; se construye localmente |
| Línea de tiempo, gráficas y foto a los 14 min | Sí (MATCH-V5 y su timeline, 2 llamadas por partida) | ◐ | ✅ | Con 100 peticiones cada 2 min solo alcanza para unos pocos usuarios a la vez |
| Perfil de **otro** jugador (buscador) | Sí (ACCOUNT, LEAGUE y MATCH) | ❌ en la práctica | ✅ | Cada búsqueda gasta 10-20 llamadas |
| Pantalla de carga (rango y maestría de los 10) | Sí (LEAGUE y MASTERY) | ◐ (ya funciona, con poco margen) | ✅ | Sin MMR, sin jugadores ocultos y sin etiquetas negativas |
| Builds y tier list (agregados) | Sí (rastreo de partidas) | ◐ pocas partidas: «Datos limitados» | ✅ | El volumen marca la calidad |
| Counters, sinergias, rendimiento por objeto y cambio por parche | Sí (rastreo masivo) | ❌ muestra demasiado pequeña | ✅ | Hacen falta miles de partidas por campeón y rol |
| Filtros de rango y región | Sí (rastrear cada rango) | ❌ | ✅ | Multiplica las llamadas por cada rango |
| Builds de pros y one-tricks | Sí (seguir cuentas concretas) | ◐ unas pocas cuentas | ✅ | |
| Probabilidad de victoria por minuto | Sí (timeline y un modelo propio) | ◐ el modelo necesita muchas partidas | ✅ | |
| Recomendación de draft | Sí (enfrentamientos y sinergias) | ❌ | ✅ | Siempre como **varias opciones**, nunca «elige X» |
| % de victorias de **aumentos** u **objetos de Arena** | — | 🚫 | 🚫 | **Prohibido por la política**, con cualquier clave. Solo niveles y descripciones |
| Cooldowns de definitivas o hechizos **enemigos** automáticos, posición del jungla no vista, MMR, desanonimizar | — | 🚫 | 🚫 | **Prohibido**: es información de la partida que el jugador no tiene |

**Conclusión:**
- Casi todo lo que hace que Blitz «se vea completo» en el **cliente del propio jugador** (perfil, historial, PL, post-partida, retos y overlays con datos visibles) se puede hacer **ya**, con datos locales de la LCU y de la Live Client Data API y sin gastar clave.
- Lo que de verdad necesita la clave de producción es el **volumen de estadísticas**: counters, filtros por rango, rendimiento por objeto, pros y draft. También la necesita **cualquier búsqueda de otros jugadores**.

## 4. Mejoras priorizadas para que la interfaz sea «mucho más completa, como Blitz»

Están ordenadas por lo que aportan, lo que cuestan y si dependen o no de la clave de producción.

### Prioridad 1: sin clave de producción y con mucho impacto visual

1. **Vista «Perfil»**, nueva en la barra lateral:
   - rango Solo y Flex, % de victorias, últimas 10 partidas y rendimiento por campeón, sacados de la LCU (`/lol-ranked/v1/current-ranked-stats` y `/lol-match-history/v1/products/lol/current-summoner/matches`);
   - **gráfica de PL** guardando una foto del rango al acabar cada partida.
2. **Historial de partidas** con KDA, CS/min, oro por minuto, objetos, runas y los 10 jugadores. Etiquetas **positivas** (MVP, más daño, más oro, buena visión), calculadas en local.
3. **Post-partida con pestañas** (Resumen · Estadísticas · Gráficas · Análisis IA):
   - aprovecha el análisis con IA que ya existe (`VistaAnalisis.tsx`);
   - añade la tabla de los 10 jugadores con las estadísticas de fin de partida de la LCU;
   - las gráficas de oro, daño, CS y nivel salen del timeline de MATCH-V5, que es 1 llamada por partida y solo del propio jugador, así que cabe en la clave de desarrollo.
4. **Puntuaciones de 0 a 100** de combate, farmeo y visión, comparadas con la media de su campeón y rol que el servidor ya calcula, como hace Blitz.
5. **Tendencias y retos de práctica**, como las «Reps» de Game Coach:
   - tarjetas de CS/min, diferencia de oro a los 14 min, KP y muertes por partida;
   - un reto activo cada vez («≥ 7 CS/min en 5 partidas»), con racha;
   - encaja con la voz: «Te quedan 20 CS para tu reto».
6. **Overlays nuevos con datos visibles:**
   - **diferencia de oro de objetos por línea** (Tab);
   - **temporizadores de inhibidores** (evento `InhibKilled`);
   - **recordatorio de baratija**;
   - **reliquias de ARAM** a mano, como la jungla manual.
7. **Información clave del campeón** en la vista Campeón: fortalezas, debilidades y campeones parecidos, generadas una vez con la IA del servidor y revisadas. No dependen de la API de Riot.
8. **Ajuste «Traer Coach LoL IA al frente al bloquear el campeón»**, como Blitz y iTero.
9. **Noticias y notas de parche** enlazadas: lista de parches con el enlace oficial y los cambios de tus campeones.

### Prioridad 2: mejor con la clave de producción (se puede preparar ya con «Datos limitados»)

10. **Counters y enfrentamientos** por campeón y rol: % de victorias en la partida y en la fase de líneas contra cada rival, con el número de partidas y la insignia «Datos limitados» si hay pocas.
11. **Filtros de rango, región y parche** en la tier list y en las builds, más el **cambio de % respecto al parche anterior**.
12. **Tabla de rendimiento por objeto** (de la Grieta, **nunca de Arena**): % de victorias, % de victorias antes de comprarlo y % de picks.
13. **Builds de one-tricks y pros**, siguiendo una lista corta de cuentas públicas.
14. **Sinergias** (dúo de línea inferior y jungla con medio).
15. **Foto a los 14 min frente al rival de línea** (diferencia de oro, XP y CS), sacada del timeline.

### Prioridad 3: diferenciales grandes que exigen la clave de producción y más trabajo

16. **Asistente de draft** en la selección de campeón:
    - de 3 a 5 opciones de pick con su motivo (counter, sinergia o tu maestría), **nunca una sola orden**, para cumplir «no dictar decisiones»;
    - puntuación del draft al terminar.
17. **Probabilidad de victoria por minuto** en el post-partida, con un modelo entrenado con nuestras partidas.
18. **Coach de macro por fases** (0-7, 7-14…) con percentiles frente a tu elo, como iTero+, aprovechando la IA que ya existe.
19. **Buscador de jugadores** con perfil público: solo con producción, por el gasto de llamadas.
20. **Tarjeta para compartir** tras ARAM: Caos o Arena, sin % de aumentos.

### Lo que NO hay que copiar (política de Riot)

- % de victorias de aumentos y de objetos de Arena: Blitz e iTero solo enseñan niveles, y Coach LoL IA ya lo hace así desde la 3.2 y la 3.4.
- Temporizadores automáticos de definitivas o hechizos **enemigos**.
- Posición del jungla enemigo cuando no se ve. La estimación actual se basa solo en eventos oficiales y en una ruta habitual, y es opcional: mantenerla así.
- MMR, buscar jugadores ocultos o anónimos y etiquetas negativas.
- Cualquier cosa que necesite **leer la memoria del juego**, prohibida desde el 6-10-2026.
