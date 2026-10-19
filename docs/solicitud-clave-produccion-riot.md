# Solicitud de clave de producción en Riot Developer Portal

Dónde: https://developer.riotgames.com → **Register Product** → **Production API Key**.
Riot revisa las solicitudes a mano y suele tardar de días a semanas. Escríbela en inglés, porque lo revisan en inglés.

## Product Name
Coach LoL IA

## Product URL
https://www.coachlolia.com

## Product Description (copy and paste)

Coach LoL IA is a Spanish-language desktop companion app for League of Legends players in EUW, LAN and LAS (Windows 10/11, Electron).

What it does:
- Champion select: it shows the most-played builds for the picked champion and role (runes, summoner spells, starting items, core items, boots and skill order), with up to 3 alternative builds and their pick and win rates. The player can import the runes, spells and an item set into the client with one click, through the official League Client API (LCU).
- In game (Premium): a small overlay shows reminders based only on the player's own data from the official Live Client Data API (127.0.0.1:2999): the next item to buy with the gold they have, the next skill to level, and the spawn times of epic objectives (Dragon, Elder, Void Grubs, Herald, Baron), taken from public game events.
- It does NOT read game memory, inject code, capture the screen or automate input. It does NOT show enemy summoner or ultimate cooldowns, enemy jungle timers or enemy positions. It never shows information the player could not see in the game client.

How we use the Riot API:
- A backend server collects ranked solo/duo matches (queue 420) of Emerald+ players in EUW1, LA1 and LA2 using league-v4 and match-v5 (matches and timelines).
- It aggregates them every 6 hours into per-champion and per-role build statistics.
- It respects the rate limits with per-region limiters and Retry-After handling.
- The API key is stored only on the server as an environment secret and is never shipped in the app or the website.
- We store only aggregated build data and match IDs. No personal player data is shown or sold.

Monetization: builds and import are free, and the website shows ads (Google AdSense). An optional Premium subscription (4.99 EUR/month) unlocks the in-game overlay and removes ads. If any part of this monetization does not fit Riot's policies, we will adapt it.

Legal: the app and the website show the "Coach LoL IA isn't endorsed by Riot Games…" disclaimer.

Contact: support@coachlolia.com

## Notas para ti (no copiar)
- Ten la web y la release v2.0.1 publicadas: Riot puede mirarlas. Ya lo están.
- Si te preguntan por usuarios o tráfico, puedes decir que está en fase de lanzamiento.
- Si Riot pide cambios en la monetización, por ejemplo que el overlay sea gratuito, se ajusta en el código: avísame.
