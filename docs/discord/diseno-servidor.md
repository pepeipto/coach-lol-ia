# Diseño del servidor

El diseño en código está en [`tools/discord/servidor.mjs`](../../tools/discord/servidor.mjs); este documento lo explica. Si cambias uno, cambia el otro.

## Ideas que lo guían

- **Pocos canales y claros.** Un servidor pequeño con 40 canales parece vacío. Empezamos con 20 canales de texto y 6 de voz; si alguno se queda muerto un mes, se archiva.
- **Bilingüe sin duplicar.** Todo en español primero y en inglés debajo. Para charlar: #general (ES) y #english (EN).
- **Ayuda ordenada.** Los fallos van a un **foro** (#soporte-y-bugs): un hilo por problema, con etiquetas, para que nada se pierda en el chat.
- **Sin bots que mantener.** Los roles autoasignables usan **Canales y roles** de Discord (nativo) y la moderación usa **AutoMod** (nativo). El script crea ambos.
- **Cumple las políticas de Riot.** Nada de trampas, cuentas, elo boost, apuestas ni MMR, y el aviso legal de Riot en #reglas. Los retos y torneos no tienen premios en dinero.

## Categorías y canales

«Predeterminado» = lo ve todo miembro nuevo aunque no elija nada en «Canales y roles».

| Categoría | Canal | Tipo | Quién escribe | Notas |
| --- | --- | --- | --- | --- |
| 📌 Bienvenida | #bienvenida | texto | Equipo (los demás reaccionan) | Mensaje fijado de bienvenida. Invitación permanente. Predeterminado. |
| | #reglas | texto | Equipo | Reglas ES/EN y aviso legal de Riot. Canal de normas de la Comunidad. Predeterminado. |
| | #roles | texto | Equipo | Cómo elegir roles en «Canales y roles». |
| 📣 Coach LoL IA | #anuncios | anuncios | Equipo (los demás reaccionan) | Otros servidores pueden «Seguirlo». Predeterminado. |
| | #novedades | anuncios | Equipo y webhook «GitHub» | Cada release, sola desde GitHub. Predeterminado. |
| | #parches | texto | PatchBot (Equipo) | Notas de cada parche de LoL, publicadas por PatchBot. |
| | #descargas-y-faq | texto | Equipo | Descarga oficial y FAQ ES/EN. Predeterminado. |
| | #beta | texto | Equipo y Beta tester | **Privado:** solo lo ven Beta tester y Equipo. |
| 🛠️ Ayuda | #ayuda | texto | Todos (modo lento 5 s) | Dudas rápidas. Predeterminado. |
| | #soporte-y-bugs | foro | Todos (un hilo por problema) | Etiquetas: 🐞 Bug, 💿 Instalación, 🖥️ Overlay, 🔊 Voz, 🧠 Análisis IA, 📦 Builds y runas, ✅ Resuelto (solo Equipo). Guía fijada y cerrada. Predeterminado. |
| | #sugerencias | foro | Todos | Etiquetas: 💡 Idea y, solo Equipo, 🔍 En estudio, 🗓️ Planeada, ✅ Hecha, ❌ Descartada. Reacción por defecto 👍. Predeterminado. |
| 🎮 Comunidad | #general | texto | Todos | Charla en español. Mensajes de sistema (bienvenida a cada miembro). Predeterminado. |
| | #english | texto | Todos | Charla en inglés. Predeterminado. |
| | #builds-y-runas | texto | Todos | Predeterminado. |
| | #clips | texto | Todos (modo lento 30 s) | Predeterminado. |
| | #retos-de-la-semana | texto | Equipo publica; todos responden **en hilos** | Ver [promocion.md](promocion.md#retos-semanales). Predeterminado. |
| | #buscar-duo | texto | Todos (modo lento 2 min) | LFG con plantilla fijada. Predeterminado. |
| | #directos | texto | Streamer y Equipo | Avisos de directos y vídeos. |
| | #off-topic | texto | Todos | Predeterminado. |
| 🔊 Voz | Sala general · Dúo 1 (2) · Dúo 2 (2) · Flex · 5 (5) · Clash · 5 (5) | voz | Todos | Entre paréntesis, el límite de personas. |
| | 🎵 Música | voz | Todos | Sala para Jockie Music. |
| | Charlas y eventos | escenario | Equipo habla; los demás piden la palabra | Para presentar versiones, preguntas y respuestas o torneos. |
| 🔒 Equipo | #equipo | texto | Equipo | **Privado.** |
| | #moderacion | texto | Equipo | **Privado.** Alertas de AutoMod y avisos de Discord para la Comunidad. |

## Roles

De arriba abajo (el orden importa: un rol solo puede gestionar los que tiene por debajo).

| Rol | Color | Cómo se consigue | Para qué |
| --- | --- | --- | --- |
| **Equipo** | dorado `#C8AA6E` | Lo da Carlos | Modera: borrar y fijar mensajes, silenciar, expulsar, banear, gestionar hilos, eventos y roles inferiores, mencionar @everyone. **No** es administrador. |
| **Beta tester** | turquesa `#0AC8B9` | Lo da el Equipo | Ve #beta y prueba versiones antes. |
| **Streamer** | morado `#9146FF` | Lo da el Equipo (enlace al canal, sin mínimo de seguidores) | Puede publicar en #directos. Se ve aparte en la lista de miembros. |
| Avisos de novedades / Avisos de retos | — | Autoasignable | El webhook de #novedades menciona al primero; el reto semanal, al segundo. Así nadie recibe menciones que no quiere. |
| ES / EN | — | Autoasignable (obligatorio elegir uno) | Idioma. |
| EUW, EUNE, LAN, LAS, NA, BR | — | Autoasignable (varios) | Región, para #buscar-duo. |
| Top, Jungla, Mid, ADC, Support | — | Autoasignable (varios) | Posición, para #buscar-duo. |
| Hierro, Bronce, Plata, Oro, Platino, Esmeralda, Diamante, Maestro+ | colores de cada liga | Autoasignable (uno) | Rango **declarado por cada uno**. No se calcula ni se publica el MMR de nadie. |

Los roles autoasignables se eligen al entrar (preguntas de **Canales y roles**) y se cambian cuando se quiera desde el menú del servidor → Canales y roles.

## Permisos

**@everyone en todo el servidor:** ver canales, crear invitaciones, cambiarse el apodo, escribir, escribir en hilos, crear hilos públicos, insertar enlaces, adjuntar archivos, reaccionar, emojis y stickers externos, leer el historial, usar comandos de aplicaciones, y en voz: conectar, hablar, emitir, actividad de voz y pedir la palabra. Todo lo demás (mencionar @everyone, gestionar mensajes, crear hilos privados, enviar mensajes de texto a voz...) queda desactivado.

**Plantillas por canal:**

| Plantilla | @everyone | Rol con permiso | Canales |
| --- | --- | --- | --- |
| Solo lectura | ✗ escribir, crear hilos, reaccionar | Equipo: ✓ escribir, reaccionar | #reglas, #roles, #descargas-y-faq |
| Solo lectura con reacciones | ✗ escribir, crear hilos | Equipo: ✓ escribir | #bienvenida, #anuncios, #novedades |
| Privado de Beta | ✗ ver | Beta tester y Equipo: ✓ ver | #beta |
| Retos | ✗ escribir, crear hilos · ✓ escribir en hilos | Equipo: ✓ escribir, crear hilos | #retos-de-la-semana |
| Directos | ✗ escribir, crear hilos | Streamer: ✓ escribir, insertar enlaces · Equipo: ✓ escribir | #directos |
| Privado del Equipo | ✗ ver | Equipo: ✓ ver | Categoría 🔒 Equipo y sus canales |
| (sin cambios) | lo de @everyone | — | El resto |

## Ajustes del servidor que pone el script

- **Modo Comunidad** activado (#reglas como canal de normas y #moderacion para los avisos de Discord).
- **Verificación media:** correo verificado y cuenta con más de 5 minutos.
- **Filtro de contenido explícito** para todos los miembros.
- **Notificaciones: solo menciones** (si no, cada mensaje notificaría a todo el mundo).
- Idioma principal: español. Descripción del servidor. Icono de la app si no tenía.

## AutoMod

Todas bloquean el mensaje, avisan en #moderacion y no afectan al Equipo.

| Regla | Qué bloquea |
| --- | --- |
| Trampas, cuentas y elo boost | elo boost, venta y compra de cuentas, scripts y hacks de LoL (lista en `servidor.mjs`). |
| Apuestas y estafas | apuestas, casinos, «RP/skins/Nitro gratis» y dominios falsos típicos. |
| Invitaciones a otros servidores | enlaces `discord.gg/...` salvo la invitación oficial (tampoco afecta a Streamer). |
| Insultos graves y contenido sexual | listas predefinidas de Discord. |
| Spam de menciones | más de 5 menciones en un mensaje; además, silencia 10 minutos. |
| Spam | mensajes que Discord detecta como spam. |

## Mensajes fijados

Cada archivo de [mensajes/](mensajes/) se publica y fija en su canal (un mensaje por bloque separado con `---`). En los foros, el primer bloque es el título de la publicación de guía, que se fija y se cierra. `<#canal>` y `<@&Rol>` se convierten en menciones reales y no notifican a nadie.

| Archivo | Canal |
| --- | --- |
| bienvenida.md | #bienvenida |
| reglas.md | #reglas (incluye el aviso legal literal de Riot) |
| roles.md | #roles |
| novedades.md | #novedades |
| descargas-y-faq.md | #descargas-y-faq (descarga oficial, instalación y FAQ en ES y EN) |
| beta.md | #beta |
| ayuda.md | #ayuda |
| soporte-y-bugs.md | #soporte-y-bugs (plantilla para informar de un fallo) |
| sugerencias.md | #sugerencias (incluye lo que Riot no permite hacer a ninguna app) |
| retos.md | #retos-de-la-semana |
| buscar-duo.md | #buscar-duo (plantilla LFG) |
| directos.md | #directos |
