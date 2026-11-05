# App Note para Riot: planes para cubrir el coste de la IA

Para enviar desde el portal de desarrolladores de Riot (App 895670 → «App Notes») el mismo día del lanzamiento. En la solicitud de la clave de producción dijimos que la app es gratis y que cualquier extra de pago lo comunicaríamos por una App Note ([solicitud-clave-produccion-riot.md](solicitud-clave-produccion-riot.md)).

Si Riot pide cambios o que lo quitemos, se apaga con `PREMIUM_HABILITADO` (servidor) sin tocar nada más, y luego se publica la app con la constante apagada.

_Hecho con ayuda de IA._

---

## Texto para pegar (en inglés)

Hello Riot team,

Coach LoL IA (App 895670) has been completely free so far. As we said in our production key application, we are letting you know about a change: we are adding optional plans whose only purpose is to cover the cost of our cloud AI coach.

**Why:** every AI match review and every question to the AI coach is a paid call to a language model. The free tier already costs us money per user, and donations do not cover it. The plans pay for that usage; they do not lock any other feature.

**What stays free for everyone, with no limits:** builds, runes, summoner spells, skill order, one-click import into the client, the in-game overlay and the voice coach. Nothing that is shown or said during a game is paid, and the app never shows information the player would not otherwise have.

**What the plans change:** only how many AI reviews and AI questions you get per month. The AI reviews run after the game ends, on the player's own match.

| Plan | Price | AI match reviews / month | AI questions / month |
|---|---|---|---|
| Free | €0 | 3 | 20 |
| Ally | €4.99/month | 10 | 50 |
| Strategist | €8.99/month | 30 | 150 |
| Marshal | €14.99/month | 60 | 300 |
| Legend | €24.99/month | 120 | 600 |

Strategist, Marshal and Legend plans can also buy one-time packs of extra AI reviews (25 for €8.99, 50 for €14.99, 100 for €23.99).

**How this fits the General Policies:**
- There is a free tier of access with every feature in it; plans only raise the monthly AI quota.
- What is paid for is transformative content (an AI-written review of the player's own match), not raw API data.
- No betting, no gambling, no ads inside the game, the client or the loading screen.
- In-game tips are free and only use the Live Client Data API.
- Payments go through Stripe; we never see or store card data.

If any part of this does not fit your policies, please tell us and we will change it or switch the plans off right away: it is a single server setting.

Thank you,
Coach LoL IA (coachlolia.com) · support@coachlolia.com

---

## Lanzamiento, paso a paso

1. **Fusiona el PR** de los planes. Así la app y la web se construyen con los planes encendidos.
2. **Stripe**: crea un producto con precio mensual para cada plan (Aliado 4,99 €, Estratega 8,99 €, Mariscal 14,99 €, Leyenda 24,99 €) y uno de pago único para cada paquete (25, 50 y 100 partidas). Copia cada `price_…`.
3. **Webhook de Stripe** hacia `https://<servidor>/api/stripe/webhook` con los eventos `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.updated`, `customer.subscription.deleted` e `invoice.payment_failed`. Copia el secreto `whsec_…`.
4. **Servidor** (fly secrets): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ESTRATEGA` (o el `STRIPE_PRICE_ID` de antes), `STRIPE_PRICE_ALIADO`, `STRIPE_PRICE_MARISCAL`, `STRIPE_PRICE_LEYENDA`, `STRIPE_PRICE_PARTIDAS25`, `STRIPE_PRICE_PARTIDAS50`, `STRIPE_PRICE_PARTIDAS100`, `PRUEBA_SAL` (cadena aleatoria) y `PREMIUM_HABILITADO=1`. Un plan o paquete sin precio no se ofrece (responde 400).
5. **Publica** la web y una versión nueva de la app.
6. **Envía esta App Note** a Riot el mismo día.
