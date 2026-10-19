import { useState } from 'react';
import { clases } from './componentes';

export const CDN_DDRAGON = 'https://ddragon.leagueoflegends.com/cdn';

export type TipoIcono = 'objeto' | 'hechizo' | 'runa' | 'campeon';

interface Props {
  tipo: TipoIcono;
  id: string | number;
  version: string;
  nombre: string;
  tamano?: number;
  /** Fichero o ruta de la imagen: el de hechizos (`SummonerFlash.png`) o el de runas (`perk-images/...`). */
  imagen?: string;
  className?: string;
}

/** URL de Data Dragon del icono, o null si no hay datos suficientes para pedirla. */
export function urlIcono(tipo: TipoIcono, id: string | number, version: string, imagen?: string): string | null {
  if (id === 0 || id === '') return null;
  switch (tipo) {
    case 'objeto':
      return version ? `${CDN_DDRAGON}/${version}/img/item/${id}.png` : null;
    case 'campeon':
      return version ? `${CDN_DDRAGON}/${version}/img/champion/${id}.png` : null;
    case 'hechizo':
      return version && imagen ? `${CDN_DDRAGON}/${version}/img/spell/${imagen}` : null;
    case 'runa':
      return imagen ? `${CDN_DDRAGON}/img/${imagen}` : null;
  }
}

/** Icono de Data Dragon con el nombre como tooltip; si falta la imagen deja un hueco del mismo tamaño. */
export function IconoDDragon({ tipo, id, version, nombre, tamano = 36, imagen, className }: Props) {
  const [fallo, setFallo] = useState(false);
  const url = urlIcono(tipo, id, version, imagen);
  const estilo = { width: tamano, height: tamano };
  const clase = clases('icono-dd', `icono-${tipo}`, className);
  if (!url || fallo) return <span className={clases(clase, 'hueco')} style={estilo} title={nombre} />;
  return (
    <img
      className={clase}
      style={estilo}
      src={url}
      alt={nombre}
      title={nombre}
      width={tamano}
      height={tamano}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFallo(true)}
    />
  );
}
