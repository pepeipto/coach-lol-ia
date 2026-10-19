import { describe, expect, it } from 'vitest';
import { crearEstadoOcupado, FASES_OCUPADAS } from '../src/main/ocupado';

function montar() {
  let carga = false;
  let partida = false;
  const estado = crearEstadoOcupado({ carga: { activa: () => carga }, partida: { enPartida: () => partida } });
  return { estado, ponerCarga: (v: boolean) => (carga = v), ponerPartida: (v: boolean) => (partida = v) };
}

describe('ocupado(): cuándo no se puede reiniciar la app', () => {
  it('libre sin fase, en el lobby, en cola o tras la partida', () => {
    const { estado } = montar();
    expect(estado.ocupado()).toBe(false);
    for (const fase of ['None', 'Lobby', 'Matchmaking', 'EndOfGame', 'PreEndOfGame']) {
      estado.fase(fase);
      expect(estado.ocupado()).toBe(false);
    }
  });

  it.each(['ReadyCheck', 'ChampSelect', 'GameStart', 'InProgress', 'Reconnect', 'WaitingForStats'])('ocupado en la fase %s', (fase) => {
    const { estado } = montar();
    estado.fase(fase);
    expect(estado.ocupado()).toBe(true);
    estado.fase('Lobby');
    expect(estado.ocupado()).toBe(false);
  });

  it('las fases ocupadas son exactamente las de la selección, la carga y la partida', () => {
    expect([...FASES_OCUPADAS].sort()).toEqual(['ChampSelect', 'GameStart', 'InProgress', 'ReadyCheck', 'Reconnect', 'WaitingForStats']);
  });

  it('ocupado con la pantalla de carga en el overlay o con la partida en curso, aunque no haya fase', () => {
    const { estado, ponerCarga, ponerPartida } = montar();
    ponerCarga(true);
    expect(estado.ocupado()).toBe(true);
    ponerCarga(false);
    ponerPartida(true);
    expect(estado.ocupado()).toBe(true);
  });

  it('al desconectarse el cliente de LoL se olvida la fase (pero la partida en curso sigue contando)', () => {
    const { estado, ponerPartida } = montar();
    estado.fase('ChampSelect');
    estado.desconectado();
    expect(estado.ocupado()).toBe(false);
    ponerPartida(true);
    expect(estado.ocupado()).toBe(true);
  });
});
