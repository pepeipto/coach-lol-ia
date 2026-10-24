# Departamento de desarrollo de Coach LoL IA

Desde la 3.8 el trabajo se reparte en **sectores**. Cada sector es una sesión de Claude en su propia rama y su propia copia
del repositorio, trabajando a la vez. El **jefe de proyecto** fija el contrato entre sectores, revisa lo que entrega cada
uno, lo fusiona en `main` y saca la versión.

## 3.8 «Todo LoL»

| Sector | Rama | Qué hace | Puede tocar |
| --- | --- | --- | --- |
| 1. Servidor LoL | `sector/servidor-lol` | Modos rotativos automáticos: detectar las colas activas, recogerlas con su parte del presupuesto, agregarlas y servirlas | `server/` (no `server/src/tft/`) |
| 2. App LoL | `sector/app-lol` | Que la app sirva en cualquier partida de LoL: normales con datos de clasificatoria, modos rotativos con su build (o la del mapa con aviso), voz adaptada a cada modo y perfil separado por cola | `app/` (no `app/src/**/tft/`) |

TFT (servidor y app) y la web quedan para la 3.9.

## Reglas

1. **El contrato manda.** [`shared/src/rotativos.ts`](../../shared/src/rotativos.ts) define las rutas y los tipos entre el
   servidor y la app. Ningún sector lo cambia: si hace falta otra cosa, se pide al jefe de proyecto.
2. **Cada uno en sus carpetas.** No se tocan archivos de otro sector ni de `shared/` (salvo lo que el jefe de proyecto
   indique). Los textos nuevos de la app van en `app/src/shared/i18n/*.json`, en los 5 idiomas.
3. **Normas de Riot siempre.** Sin porcentajes de victoria de aumentos ni de objetos de Arena, sin información oculta del
   rival, sin MMR, sin dictar acciones (`shared/src/politica.ts`). Solo API oficial.
4. **Pruebas.** Cada cambio con su prueba. Antes de entregar: `npx vitest run` en la raíz sin fallos y
   `npx tsc --noEmit -p tsconfig.json` en `app/` y `-p .` en `server/` sin errores.
5. **Entrega.** Commits en la rama del sector (en español, como los del repositorio), sin push, sin fusionar en `main`,
   sin desplegar el servidor y sin compilar el instalador: eso lo hace el jefe de proyecto. Al acabar, un resumen de qué
   hiciste, qué no y cómo probarlo.
6. **Seguridad.** Nunca escribir claves (Riot, Anthropic, ElevenLabs, Discord) en código, registros ni commits. Antes de
   arrancar Electron, comprobar que no hay ningún proceso de League of Legends o del cliente de Riot abierto; si lo hay, no
   se arranca.
