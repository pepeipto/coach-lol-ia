import { describe, expect, it } from 'vitest';
import { establecerIdioma } from '../src/shared/i18n';
import { interpretarPartida } from '../src/main/perfil/lcuPerfil';
import { datosTarjeta } from '../src/renderer/principal/vistas/tarjetaCompartir';
import type { Perfil } from '../src/shared/perfil';
import { partidaLcu } from './partidaLcu';

const perfil = (o: Partial<Perfil> = {}): Perfil => ({
  invocador: { nombre: 'Yo', tag: 'EUW', nivel: 100, icono: 1 },
  rangos: [],
  pl: [],
  partidas: [],
  campeones: [],
  tendencias: [],
  reto: null,
  retoSugerido: 'cs7',
  actualizado: null,
  conectado: false,
  version: '16.21.1',
  campeonesDD: { 1: { id: 'Annie', nombre: 'Annie' } },
  ...o,
});

describe('3.7: tarjeta compartible', () => {
  establecerIdioma('es');
  const p = interpretarPartida(partidaLcu(7, { duracion: 1800 }), 'puuid-yo')!;

  it('resume la partida del jugador con su nota, KDA y estadísticas', () => {
    const d = datosTarjeta(p, perfil());
    const yo = p.jugadores.find((j) => j.participante === p.yo)!;
    expect(d.victoria).toBe(p.victoria);
    expect(d.nota).toBe(Math.round(yo.puntuaciones.total));
    expect(d.kdaDetalle).toBe(`${yo.asesinatos}/${yo.muertes}/${yo.asistencias}`);
    expect(d.stats.map((s) => s.etiqueta)).toContain('CS/min');
    expect(d.subtitulo).toContain('30:00');
  });

  it('no lleva el nombre ni el Riot ID de ningún jugador', () => {
    const d = datosTarjeta(p, perfil());
    const texto = JSON.stringify(d);
    for (const j of p.jugadores) if (j.nombre) expect(texto).not.toContain(j.nombre);
  });

  it('incluye el reto activo con su progreso', () => {
    const d = datosTarjeta(p, perfil({ reto: { id: 'cs7', hechas: 3, objetivo: 5, racha: 1, completado: false, desde: '', ultimas: [] } }));
    expect(d.reto).toBe('Farmea bien · 3/5');
  });
});
