export type TipoAviso = 'compra' | 'habilidad' | 'objetivo' | 'vision' | 'fase';

export interface Ajustes {
  avisos: Record<TipoAviso, boolean>;
  voz: boolean;
  importacionAutomatica: boolean;
  teclaOverlay: string;
  posicionOverlay: { x: number; y: number } | null;
  urlServidor: string;
}

export interface SeleccionCampeon {
  campeonId: number;
  rol: import('@coach/shared').Rol | null;
}

import type { Rol } from '@coach/shared';
import type { ResultadoBuild } from '../main/builds/clienteBuilds';

/** Nombres e iconos (de Data Dragon) de lo que aparece en la build, para pintarla en la ventana. */
export interface RecursosBuild {
  objetos: Record<number, string>;
  runas: Record<number, { nombre: string; icono: string }>;
  hechizos: Record<number, { nombre: string; imagen: string }>;
}

export interface EstadoPrincipal {
  cliente: 'esperando' | 'conectado';
  seleccion: {
    campeon: { id: string; nombre: string; key: number };
    rol: Rol;
    rolesDisponibles: Rol[];
    resultado: ResultadoBuild;
  } | null;
  version: string; // Data Dragon, para las imágenes ('' si no hay datos)
  recursos: RecursosBuild;
  /** 'datos' si no se pudieron cargar los datos de Data Dragon (sin red ni caché). */
  error: 'datos' | null;
  /** Resultado de la última importación (automática o manual) de la selección actual. */
  importacion: ResultadoImportar | null;
}

export type ResultadoParte = { ok: true } | { ok: false; motivo: 'sin_paginas' | 'error' };
export interface ResultadoImportar {
  runas: ResultadoParte;
  hechizos: ResultadoParte;
  objetos: ResultadoParte;
}

export interface ApiCoach {
  alCambiarEstado(cb: (e: EstadoPrincipal) => void): void;
  importar(): Promise<ResultadoImportar>;
  cambiarRol(rol: Rol): Promise<void>;
  obtenerAjustes(): Promise<Ajustes>;
  guardarAjustes(a: Ajustes): Promise<void>;
  moverOverlay(activar: boolean): Promise<void>;
}

export interface EventoPartida {
  nombre: string; // EventName
  tiempo: number; // EventTime, en segundos
}

export interface EstadoPartida {
  tiempo: number;
  oro: number;
  nivel: number;
  /** Id de Data Dragon (p. ej. "Ahri"). */
  campeon: string;
  objetos: number[];
  habilidades: Record<import('@coach/shared').Habilidad, number>;
  eventos: EventoPartida[];
}

export interface Indicacion {
  tipo: TipoAviso;
  clave: string;
  texto: string;
}

export interface Panel {
  proximaCompra: string | null;
  proximoObjetivo: string | null;
}
