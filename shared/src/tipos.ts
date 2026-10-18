export type Rol = 'TOP' | 'JUNGLE' | 'MIDDLE' | 'BOTTOM' | 'UTILITY';
export const ROLES: Rol[] = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'];

export type Habilidad = 'Q' | 'W' | 'E' | 'R';

/** runas: 9 ids: 4 principal, 2 secundaria, 3 fragmentos (ataque, flexible, defensa). */
export interface PaginaRunas {
  estiloPrincipal: number;
  estiloSecundario: number;
  runas: number[];
}

export interface Build {
  campeon: string; // id de Data Dragon, p. ej. "Ahri"
  rol: Rol;
  parche: string; // "15.20"
  partidas: number;
  tasaVictoria: number; // 0..1
  mezclaParches: boolean;
  runas: PaginaRunas;
  hechizos: [number, number];
  objetosIniciales: number[];
  nucleo: number[];
  botas: number | null;
  situacionales: number[];
  ordenHabilidades: Habilidad[]; // 18 elementos
  calculadoEn: string; // ISO
  /** 0..1: partidas de esta opción entre el total del campeón y rol (falta en builds de v1). */
  popularidad?: number;
  /**
   * Solo en la build de nivel superior que sirve el servidor: las 1-3 opciones por núcleo, con la
   * más jugada (la propia build de nivel superior) en primera posición. Falta en builds de v1.
   */
  opciones?: Build[];
}

export interface RolesCampeon {
  campeon: string;
  roles: { rol: Rol; partidas: number }[];
}

export interface ItemDDragonCrudo {
  gold: { total: number; purchasable: boolean };
  from?: string[];
  into?: string[];
  tags?: string[];
  consumed?: boolean;
  maps?: Record<string, boolean>;
  name?: string;
}
