# Reporte del fallo del portal de Riot ("Selected app type is not available")

Hay dos mensajes en inglés, listos para copiar y pegar. Envíalos tú desde tu cuenta: van firmados por ti.

---

## 1) Comentario en GitHub, issue #1194

Dónde: https://github.com/RiotGames/developer-relations/issues/1194 (abajo, en «Add a comment»; hace falta una cuenta de GitHub).

```
Same issue here (League of Legends, not VALORANT).

- Account: AKIRA88
- Product: Coach LoL IA (https://www.coachlolia.com), a free desktop companion app for LoL that uses LEAGUE-V4 and MATCH-V5
- Steps: Developer Portal → Register Product → Production API Key → accepted the General and Tournament policies → filled in name, description, Default Group, product URL (public, with Terms and Privacy pages), Game Focus: League of Legends, tournaments: No → Submit
- Result: "Failed to create application! Selected app type is not available"
- Tried twice on 2026-10-19 from a fresh session, with the same result. Registering a Personal API key from the same account goes through the form (with a CAPTCHA), so it seems to affect only the Production type.

Is the Production application type temporarily disabled, or is there something we need to enable on our account first? Thanks!
```

---

## 2) Ticket en el soporte de desarrolladores de Riot

Dónde: https://support-developer.riotgames.com → «Submit a request» (o «Contact us»). Tipo: *Developer Portal / Application issue*.

**Subject:**
```
Production API key application fails: "Selected app type is not available"
```

**Description:**
```
Hello,

I'm trying to register a Production API key application, but the Developer Portal always fails on submit.

Account: AKIRA88
Product: Coach LoL IA (https://www.coachlolia.com)
Game: League of Legends
APIs used: LEAGUE-V4 and MATCH-V5 (EUW1, LA1, LA2)

Steps to reproduce:
1. Go to Register Product → Production API Key.
2. Accept the General Policies and the Tournament Policies.
3. Fill in Product Name, Product Description, Group (Default Group), Product URL, Game Focus (League of Legends) and "Are you organizing tournaments?" (No).
4. Click Submit.

Result: the portal goes back to the product type page and shows "Failed to create application! Selected app type is not available".

It happened twice on 2026-10-19 (Europe/Madrid). Other developers report the same in RiotGames/developer-relations issue #1194.

Coach LoL IA is free for every user (no paid features, no ads in the app). The full product description is ready to submit once the form works. In the meantime we requested a Personal API key for a small private beta.

Could you check whether the Production application type is available for my account, or submit the application on your side?

Thank you,
Carlos Fernandez Medina
support@coachlolia.com
```
