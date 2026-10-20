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
- Champion select: it shows the popular options for the picked champion and role, never a single "correct" build: up to 3 item options and 3 rune pages with their pick and win rates, plus summoner spells, starting items, boots and skill order; the player chooses. The player can import the chosen runes, spells and an item set into the client with one click, through the official League Client API (LCU).
- Loading screen: for each visible player, their official Solo/Duo rank and their mastery of the champion they picked, plus only positive or neutral labels (never MMR, never negative labels). Anonymized/hidden players are never looked up.
- In game (free for everyone): a small overlay shows reminders based only on the player's own data from the official Live Client Data API (127.0.0.1:2999): the next item to buy with the gold they have, the next skill to level, and the spawn times of epic objectives (Dragon, Elder, Void Grubs, Herald, Baron), taken from public game events.
- It does NOT read game memory, inject code, capture the screen or automate input. It does NOT show enemy summoner or ultimate cooldowns, enemy jungle timers or enemy positions. It never shows information the player could not see in the game client.

How we use the Riot API:
- For the loading screen, the server reads the rank (league-v4) and champion mastery (champion-mastery-v4) of visible players only, keeps them in memory for at most 10 minutes and never stores or logs them.
- A backend server collects ranked solo/duo matches (queue 420) of Emerald+ players in EUW1, LA1 and LA2 using league-v4 and match-v5 (matches and timelines).
- It aggregates them every 6 hours into per-champion and per-role build statistics.
- It respects the rate limits with per-region limiters and Retry-After handling.
- The API key is stored only on the server as an environment secret and is never shipped in the app or the website.
- We store only aggregated build data and match IDs. No personal player data is shown or sold.

Monetization: the app is completely free for everyone, with every feature available to every user. There are no ads inside the app. Hosting costs are covered by ads on the website (Google AdSense, only after cookie consent) and by optional donations (PayPal) that unlock nothing. If we ever want to offer an optional supporter perk that gives no gameplay advantage, we will ask Riot first through an App Note before adding it.

Support assistant: the app and the website include an AI help chat that only answers questions about using Coach LoL IA. It does not use Riot API data.

Legal: every page of the website and the app show this disclaimer, in English and, in the other languages, after its translation: "Coach LoL IA isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc."

Contact: support@coachlolia.com

## Notas para ti (no copiar)
- Antes de enviar, revisa el checklist: aviso legal literal en `/en/` y sin % de victorias de aumentos ni de objetos de Arena (política de LoL). No menciones Arena en la descripción.
- Después de *Submit*, sube `riot.txt` (ver el README) y pulsa *Verify*.
- Envíala cuando estén publicadas la web y la release 2.1.0 (todo gratis), porque Riot puede mirarlas.
- Si te preguntan por usuarios o tráfico, di que está en fase de lanzamiento.
- Premium solo se puede reactivar (`PREMIUM_HABILITADO`) si Riot lo aprueba por escrito en una App Note.
