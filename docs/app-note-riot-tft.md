# App Note para Riot: chuleta fija de TFT en la partida

Para enviar desde el portal de desarrolladores de Riot (App 895670 → «App Notes») **antes de publicar la versión 3.15.0**, igual que se hizo con la de los planes ([app-note-riot-planes.md](app-note-riot-planes.md)).

Si Riot pide cambios o que lo quitemos: la chuleta solo sale si el jugador ha elegido composiciones en la pestaña TFT; se apaga en una versión nueva quitando el orquestador `app/src/main/orquestador/tft.ts` del arranque, sin tocar nada más.

_Hecho con ayuda de IA._

---

## Texto para pegar (en inglés)

Hello Riot team,

Coach LoL IA (App 895670) is adding a small feature for Teamfight Tactics and we want to describe it to you before we release it.

**What it is:** a static "cheat sheet" panel. Before a game, in the app's TFT tab (outside the game), the player picks up to two compositions from our tier list. During a TFT game, the player can open and close a panel with a hotkey (Ctrl+Shift+O by default). The panel shows only what the player picked beforehand: the champions of those compositions, the recommended items for the carrier with their two components, and the standard item recipe table (which component plus which component makes which item).

**What it does not do:**
- It does not read anything from the game: no board, bench, shop, gold, level, augments, items held or opponents. The Live Client Data API is not used in TFT, and we do not read memory, the screen or game files.
- Nothing in the panel changes during the game. It is the same content as having a guide open on a second screen.
- No scouting, no information about other players, no augment statistics, no win rates, no real-time advice, no voice coaching in TFT.
- The panel is hidden by default, appears only when the player presses the hotkey, never takes mouse input and never covers the game's own interface for longer than the player wants.

**How it fits the policies:**
- All TFT content in the app is meant to be consulted outside the game; this panel only re-shows the player's own choice from before the game.
- The tier list behind it is built from aggregated Master+ ranked matches from the official API (tft-league-v1, tft-match-v1) and Data Dragon names and icons.
- The feature is free for every user. No ads, no betting.

If any part of this does not fit your policies, please tell us and we will change it or remove it before or right after release.

Thank you,
Coach LoL IA (coachlolia.com) · support@coachlolia.com
