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
- In game (free for everyone): a small overlay shows reminders based only on the player's own data from the official Live Client Data API (127.0.0.1:2999): the next item to buy with the gold they have, the next skill to level, and the spawn times of epic objectives (Dragon, Elder, Void Grubs, Herald, Baron), taken from public game events.
- It does NOT read game memory, inject code, capture the screen or automate input. It does NOT show enemy summoner or ultimate cooldowns, enemy jungle timers or enemy positions. It never shows information the player could not see in the game client.

How we use the Riot API:
- A backend server collects ranked solo/duo matches (queue 420) of Emerald+ players in EUW1, LA1 and LA2 using league-v4 and match-v5 (matches and timelines).
- It aggregates them every 6 hours into per-champion and per-role build statistics.
- It respects the rate limits with per-region limiters and Retry-After handling.
- The API key is stored only on the server as an environment secret and is never shipped in the app or the website.
- We store only aggregated build data and match IDs. No personal player data is shown or sold.

Monetization: the app is completely free for everyone, with every feature available to every user. There are no ads inside the app. Hosting costs are covered by ads on the website (Google AdSense, only after cookie consent) and by optional donations (PayPal) that unlock nothing. If we ever want to offer an optional supporter perk that gives no gameplay advantage, we will ask Riot first through an App Note before adding it.

Support assistant: the app and the website include an AI help chat that only answers questions about using Coach LoL IA. It does not use Riot API data.

Legal: the app and the website show the "Coach LoL IA isn't endorsed by Riot Games…" disclaimer.

Contact: support@coachlolia.com

## Notas para ti (no copiar)
- Envíala cuando estén publicadas la web y la release 2.1.0 (todo gratis), porque Riot puede mirarlas.
- Si te preguntan por usuarios o tráfico, di que está en fase de lanzamiento.
- Premium solo se puede reactivar (`PREMIUM_HABILITADO`) si Riot lo aprueba por escrito en una App Note.
