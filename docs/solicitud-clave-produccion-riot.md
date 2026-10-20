# Solicitud de clave de producción en Riot Developer Portal

Dónde: https://developer.riotgames.com → **Register Product** → **Production API Key**.
Riot revisa las solicitudes a mano y suele tardar de días a semanas. Escríbela en inglés, porque lo revisan en inglés.

## Product Name
Coach LoL IA

## Product URL
https://www.coachlolia.com

## Product Description (copy and paste)

Coach LoL IA is a free desktop companion app for League of Legends (Windows 10/11, Electron), available in Spanish, English, Brazilian Portuguese, French and German. Version 3.1.

What it does:
- Champion select: it shows the most-played builds for the picked champion and role (runes, summoner spells, starting items, core items, boots, skill order), with up to 3 item options and up to 3 rune pages, each with pick and win rates from Emerald+ games. The player can import runes, spells and an item set with one click through the official League Client API (LCU). It only creates or replaces pages named "Coach: …"; if all pages are full it asks the player before replacing one, and the automatic import never deletes anything.
- Champions section: a tier list per role and mode (Ranked, ARAM, ARAM: Mayhem, Arena) built from aggregated match data.
- Loading screen: for the ten players it shows the official Solo/Duo rank (league-v4), champion mastery (champion-mastery-v4) and our aggregated win rate for that champion and role, with positive or neutral tags only. No MMR estimates and no negative labels. It disappears as soon as the game clock starts.
- In game: an overlay and a voice coach based only on the official Live Client Data API (127.0.0.1:2999): the player's own items, gold, level, CS and KDA, the next skill to level, the next item they can afford, spawn times of epic objectives taken from public game events, and short tips. Enemy jungler callouts use only official game events that every player already sees in the kill feed (kills, assists, objectives, structures).
- It does NOT read game memory, inject code, capture or analyze the screen or minimap, or automate input. It does NOT show enemy summoner or ultimate cooldowns, enemy jungle timers or enemy positions. Jungle timers are manual, for the player's own camps only, and off by default.

How we use the Riot API:
- A backend server collects ranked solo/duo, ARAM, ARAM: Mayhem and Arena matches of Emerald+ players in EUW1, LA1 and LA2 (configurable) using league-v4 and match-v5 (matches and timelines), and aggregates them periodically into per-champion, per-role build statistics.
- Loading-screen lookups use league-v4 by PUUID and champion-mastery-v4. PUUIDs are kept only in memory for up to 10 minutes and are never logged or stored; Riot IDs are not sent to our server.
- Requests respect the rate limits with per-region priority limiters and Retry-After handling; interactive lookups can use at most 60 % of each limit so the collector always has a share.
- The API key is stored only on the server as an environment secret and is never shipped in the app or the website.
- We store only aggregated build data and match IDs. No personal player data is shown publicly or sold.

Monetization: the app is completely free, with every feature available to every user and no ads inside the app. Hosting costs are covered by ads on the website (only after cookie consent) and by optional donations that unlock nothing. If we ever want to offer an optional supporter perk with no gameplay advantage, we will ask Riot first through an App Note.

Support assistant: the app and the website include an AI help chat that only answers questions about using Coach LoL IA. It does not use Riot API data.

Legal: the app and the website show the "Coach LoL IA isn't endorsed by Riot Games…" disclaimer on every page.

Contact: support@coachlolia.com

## Notas para ti (no copiar)
- Si te preguntan por usuarios o tráfico, di que está en fase de lanzamiento.
- Premium solo se puede reactivar (`PREMIUM_HABILITADO`) si Riot lo aprueba por escrito en una App Note.
