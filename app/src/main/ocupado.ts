/**
 * Fases del cliente de LoL (gameflow de la LCU) en las que reiniciar la app estropearía algo: la cola aceptada,
 * la selección de campeón (importación de la build), la pantalla de carga, la partida, la reconexión y la espera
 * de estadísticas justo al terminar.
 */
export const FASES_OCUPADAS: ReadonlySet<string> = new Set(['ReadyCheck', 'ChampSelect', 'GameStart', 'InProgress', 'Reconnect', 'WaitingForStats']);

/**
 * Un único `ocupado()` para la actualización automática: la última fase de la LCU, la pantalla de carga en el
 * overlay y la partida en curso (Live Client). Cualquiera de las tres basta para no reiniciar.
 */
export function crearEstadoOcupado(dep: { carga: { activa(): boolean }; partida: { enPartida(): boolean } }) {
  let faseActual = '';
  return {
    fase(fase: string): void {
      faseActual = fase;
    },
    /** Sin cliente de LoL no hay fase (la partida en curso, si la hay, sigue contando por la Live Client). */
    desconectado(): void {
      faseActual = '';
    },
    ocupado(): boolean {
      return FASES_OCUPADAS.has(faseActual) || dep.carga.activa() || dep.partida.enPartida();
    },
  };
}

export type EstadoOcupado = ReturnType<typeof crearEstadoOcupado>;
