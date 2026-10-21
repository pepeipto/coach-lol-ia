import { describe, expect, it } from 'vitest';
import { charlaPrevia, conversacion, resumenPersonal } from '../src/main/ia/coachPersonal';
import { perfilDeMuestra } from '../tools/perfilDeMuestra';

const { perfil } = perfilDeMuestra('16.21.1', { 238: { id: 'Zed', nombre: 'Zed' }, 91: { id: 'Talon', nombre: 'Talon' } });

describe('3.5: coach personal', () => {
  it('el resumen lleva rango, campeones, tendencias, reto y últimas partidas, sin nombres de jugadores', () => {
    const r = resumenPersonal(perfil);
    expect(r.rango).toMatch(/Esmeralda I 31/);
    expect(r.campeones[0]).toMatchObject({ campeon: 'Zed' });
    expect(r.reto).toMatchObject({ id: 'muertes4', objetivo: 5 });
    expect(r.ultimas.length).toBeLessThanOrEqual(10);
    const json = JSON.stringify(r);
    // Ni el Riot ID del jugador ni los nombres de los demás.
    expect(json).not.toContain('AKIRA88');
    expect(json).not.toContain('Sombra Fría');
  });

  it('la conversación se limpia y tiene que acabar en el usuario', () => {
    expect(conversacion([{ rol: 'usuario', texto: '  hola   coach ' }])).toEqual([{ rol: 'usuario', texto: 'hola coach' }]);
    expect(conversacion([{ rol: 'usuario', texto: 'a' }, { rol: 'coach', texto: 'b' }])).toBeNull();
    expect(conversacion([{ rol: 'otro', texto: 'a' }])).toBeNull();
    expect(conversacion('x')).toBeNull();
    expect(conversacion(Array.from({ length: 20 }, (_, i) => ({ rol: i % 2 ? 'usuario' : 'coach', texto: String(i) })))).toHaveLength(12);
  });

  it('charla previa: el reto y cómo le va con el campeón', () => {
    const texto = charlaPrevia(perfil, 238)!;
    expect(texto).toContain('Sobrevive');
    expect(texto).toContain('Zed');
    // Sin reto ni partidas no hay nada que decir.
    expect(charlaPrevia({ ...perfil, reto: null, partidas: [], campeones: [] }, 238)).toBeNull();
  });
});
