import type { FastifyInstance } from 'fastify';
import type { Db } from './db';
import { claveIp } from './ip';

/*
 * 3.7: contador anónimo de tarjetas compartidas (la tarjeta vertical de una partida). La app avisa solo cuando el
 * jugador la copia o la guarda, sin cuerpo: no se guarda nada de quién la compartió (ni IP, ni dispositivo, ni
 * partida), solo cuántas hubo cada día. La IP se mira solo en memoria para que un mismo cliente no infle la cuenta.
 */

/** Como mucho estas tarjetas cuentan por IP y día (el resto se aceptan y no suman). */
export const MAX_TARJETAS_IP_DIA = 20;

const dia = (ahora: Date) => ahora.toISOString().slice(0, 10);

export function registrarMetricas(app: FastifyInstance, db: Db, reloj: () => Date = () => new Date()): void {
  db.sql.exec(`
    CREATE TABLE IF NOT EXISTS metricas_dia (
      dia TEXT NOT NULL,
      evento TEXT NOT NULL,
      n INTEGER NOT NULL,
      PRIMARY KEY (dia, evento)
    );
  `);
  const sumar = db.sql.prepare(
    "INSERT INTO metricas_dia (dia, evento, n) VALUES (?, 'tarjeta', 1) ON CONFLICT(dia, evento) DO UPDATE SET n = n + 1",
  );
  const total = db.sql.prepare("SELECT COALESCE(SUM(n), 0) AS n FROM metricas_dia WHERE evento = 'tarjeta'");
  const desde = db.sql.prepare("SELECT COALESCE(SUM(n), 0) AS n FROM metricas_dia WHERE evento = 'tarjeta' AND dia >= ?");
  // Solo en memoria y solo del día en curso.
  let diaPorIp = '';
  const porIp = new Map<string, number>();

  app.post('/api/metricas/tarjeta', async (req, reply) => {
    const hoy = dia(reloj());
    if (hoy !== diaPorIp) {
      porIp.clear();
      diaPorIp = hoy;
    }
    const clave = claveIp(req.ip);
    const n = (porIp.get(clave) ?? 0) + 1;
    porIp.set(clave, n);
    if (n <= MAX_TARJETAS_IP_DIA) sumar.run(hoy);
    return reply.code(204).send();
  });

  // Cifras públicas y agregadas (para el plan de difusión y la web).
  app.get('/api/metricas', async () => {
    const hace7 = new Date(reloj().getTime() - 6 * 24 * 60 * 60 * 1000);
    return {
      tarjetas: {
        total: (total.get() as { n: number }).n,
        ultimos7Dias: (desde.get(dia(hace7)) as { n: number }).n,
      },
    };
  });
}
