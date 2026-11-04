# App Note para Riot: planes de pago con cuota de coach con IA

Borrador para enviar desde el portal de desarrolladores de Riot (App 895670 → «App Notes») **antes** de encender `PREMIUM_HABILITADO`. En la solicitud de la clave de producción dijimos que la app es gratis y que cualquier extra de pago lo pediríamos antes por una App Note ([solicitud-clave-produccion-riot.md](solicitud-clave-produccion-riot.md)).

Cuándo encender los cobros: cuando Riot responda que sí. Hasta entonces, el servidor y la app siguen con el interruptor apagado y todo es gratis.

_Hecho con ayuda de IA._

---

## Texto para pegar (en inglés)

Hello Riot team,

Coach LoL IA (App 895670) is currently completely free. As promised in our production key application, we are asking before adding any paid option. We would like to introduce optional subscriptions and want to confirm they fit the General Policies before turning them on.

**What stays free for everyone, with no limits:** builds, runes, summoner spells, skill order, one-click import into the client, the in-game overlay and the offline voice coach. Nothing that is shown or said during a game is paid, and there is no information that the player would not otherwise have.

**What the paid plans add:** only more uses of our cloud AI coach, which costs us money per request (a language model analyses the player's own finished match and answers their own questions about their play). The free tier includes 3 AI match reviews and 20 AI questions per month.

| Plan | Price | AI match reviews / month | AI questions / month |
|---|---|---|---|
| Free | €0 | 3 | 20 |
| Supporter | €4.99/month | 10 | 50 |
| Coach | €8.99/month | 30 | 150 |
| Coach 2x | €14.99/month | 60 | 300 |
| Coach 4x | €24.99/month | 120 | 600 |

Coach plans can also buy one-time packs of extra AI match reviews (25 for €8.99, 50 for €14.99, 100 for €23.99).

**Why we think this fits the policies:**
- There is a free tier of access, and every feature is in it; paid plans only raise the monthly quota of AI reviews.
- What we charge for is transformative content (an AI-written review of the player's own match), not raw API data.
- No betting, no gambling, no ads inside the game, the client or the loading screen.
- The AI reviews run after the game ends and use the player's own match data. In-game tips are free and only use the Live Client Data API.
- Payments go through Stripe; we do not store card data.

Could you confirm whether this monetization model is acceptable for our product, or tell us what we should change? We will not enable payments until we hear back.

Thank you,
Coach LoL IA (coachlolia.com) · support@coachlolia.com

---

## Cómo encender los cobros cuando Riot apruebe

1. En Stripe, crea un producto por plan y paquete y copia sus `price_…` en el servidor (fly secrets):
   `STRIPE_PRICE_COACH` (o el `STRIPE_PRICE_ID` de antes), `STRIPE_PRICE_APOYO`, `STRIPE_PRICE_COACH2X`, `STRIPE_PRICE_COACH4X`,
   `STRIPE_PRICE_PARTIDAS25`, `STRIPE_PRICE_PARTIDAS50`, `STRIPE_PRICE_PARTIDAS100`. Los planes o paquetes sin precio no se ofrecen (responden 400).
2. En el webhook de Stripe, añade el evento `checkout.session.completed` de pagos únicos (los paquetes ya llegan por ese mismo evento).
3. Servidor: `PREMIUM_HABILITADO=1` y `PRUEBA_SAL`.
4. App: `PREMIUM_HABILITADO = true` en `shared/src/producto.ts` y publica una versión nueva.
5. Web: `PREMIUM_HABILITADO = true` en `web/src/lib/producto.ts`.
6. Actualiza la base de conocimiento del asistente (`server/src/asistente/conocimiento.ts`), que ahora dice que no hay planes de pago, y los textos «gratis para todos» de la web.
