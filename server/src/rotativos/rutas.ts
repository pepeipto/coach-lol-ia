import type { FastifyInstance } from 'fastify';
import type { BuildRotativa, ListaCampeones, ListaModosRotativos, ModoRotativo } from '@coach/shared';
import { listaCampeones } from '../campeones';
import type { Db } from '../db';
import { leerEstadoRotativos } from './colas';
import { colaDeModo, modoRotativo } from './modos';

/** `:cola` válida: un entero positivo escrito solo con cifras (sin signo, decimales ni ceros a la izquierda). */
function colaValida(texto: string): number | null {
  if (!/^[1-9]\d{0,8}$/.test(texto)) return null;
  return Number(texto);
}

/**
 * 3.8 «Todo LoL»: rutas de `RUTAS_ROTATIVOS` (shared/src/rotativos.ts).
 * - `GET /rotativos`: las colas activas en la última revisión y las que tienen builds del parche (aunque ya no estén
 *   activas), con `conDatos` y `pve`.
 * - `GET /rotativos/:cola/builds/:campeon`: build por campeón (rol null) o 404 `{ error: 'sin_datos' }`.
 * - `GET /rotativos/:cola/campeones`: lista de campeones con su tier (un solo grupo, como ARAM).
 */
export function registrarRotativos(app: FastifyInstance, db: Db): void {
  app.get('/rotativos', async () => {
    const estado = leerEstadoRotativos(db);
    const conDatos = new Set(db.modosRotativosConBuilds().map(colaDeModo).filter((c): c is number => c !== null));
    const colas = [...new Set([...estado.activas, ...conDatos])].sort((a, b) => a - b);
    const modos: ModoRotativo[] = [];
    for (const cola of colas) {
      const info = estado.info[String(cola)];
      // Sin datos guardados del modo (p. ej. una base sin estado), su gameMode sale de sus builds.
      const gameMode = info?.gameMode || db.builds(modoRotativo(cola)).map((b) => (b as BuildRotativa).gameMode).find((g) => !!g) || '';
      modos.push({
        cola,
        gameMode,
        mapa: info?.mapa ?? 0,
        nombre: info?.nombre ?? `Queue ${cola}`,
        conDatos: conDatos.has(cola),
        pve: info?.pve ?? false,
        activo: estado.activas.includes(cola),
      });
    }
    const respuesta: ListaModosRotativos = { actualizado: estado.actualizado ?? new Date(0).toISOString(), modos };
    return respuesta;
  });

  app.get<{ Params: { cola: string; campeon: string } }>('/rotativos/:cola/builds/:campeon', async (req, reply) => {
    const cola = colaValida(req.params.cola);
    if (cola === null) return reply.code(400).send({ error: 'cola_invalida' });
    // Data Dragon y Match-v5 no siempre coinciden en mayúsculas: el campeón se busca sin distinguirlas.
    const build = db.build(req.params.campeon.toLowerCase(), null, modoRotativo(cola));
    if (!build) return reply.code(404).send({ error: 'sin_datos' });
    const rotativa: BuildRotativa = { ...build, rol: null, cola, gameMode: (build as Partial<BuildRotativa>).gameMode ?? '' };
    return rotativa;
  });

  // Como `/campeones`: se calcula de las builds guardadas y se guarda en memoria hasta que cambian.
  const cache = new Map<number, { revision: number; lista: ListaCampeones }>();
  app.get<{ Params: { cola: string } }>('/rotativos/:cola/campeones', async (req, reply) => {
    const cola = colaValida(req.params.cola);
    if (cola === null) return reply.code(400).send({ error: 'cola_invalida' });
    const revision = db.revisionBuilds();
    const enCache = cache.get(cola);
    if (enCache && enCache.revision === revision) return enCache.lista;
    // Un solo grupo (rol null) y rendimiento por % de victorias, como ARAM.
    const lista = listaCampeones(db.builds(modoRotativo(cola)), 'aram');
    // Solo las colas con datos: una cola inventada no ocupa memoria.
    if (lista.campeones.length > 0) cache.set(cola, { revision, lista });
    return lista;
  });
}
