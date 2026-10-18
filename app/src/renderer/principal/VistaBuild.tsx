import type { Rol } from '@coach/shared';
import { t } from '../../shared/i18n';
import type { EstadoPrincipal, ResultadoImportar } from '../../shared/tiposApp';
import { SelectorRol } from './SelectorRol';

const CDN = 'https://ddragon.leagueoflegends.com/cdn';

interface Props {
  estado: EstadoPrincipal;
  importacion: ResultadoImportar | 'importando' | null;
  onImportar: () => void;
  onCambiarRol: (rol: Rol) => void;
}

function mensajeImportacion(r: ResultadoImportar): string {
  if (r.runas.ok === false && r.runas.motivo === 'sin_paginas') return t('ui.sinPaginas');
  const fallidas = (['runas', 'hechizos', 'objetos'] as const).filter((p) => !r[p].ok).map((p) => t('ui.parte.' + p));
  return fallidas.length === 0 ? t('ui.importado') : t('ui.errorImportar', { partes: fallidas.join(', ') });
}

export function VistaBuild({ estado, importacion, onImportar, onCambiarRol }: Props) {
  const sel = estado.seleccion;
  if (!sel) return null;
  const { campeon, rol, rolesDisponibles, resultado } = sel;
  const v = estado.version;
  const rec = estado.recursos;

  const icono = (id: number) => (
    <img key={id} className="icono" src={`${CDN}/${v}/img/item/${id}.png`} alt={rec.objetos[id] ?? String(id)} title={rec.objetos[id]} />
  );

  return (
    <section className="vista-build">
      <header className="cabecera">
        <img className="campeon" src={`${CDN}/${v}/img/champion/${campeon.id}.png`} alt={campeon.nombre} />
        <h2>{campeon.nombre}</h2>
        <SelectorRol rol={rol} disponibles={rolesDisponibles} onCambiar={onCambiarRol} />
      </header>

      {resultado.estado === 'no_disponible' ? (
        <p className="estado">{t('estado.buildNoDisponible')}</p>
      ) : (
        <>
          <p className="estado">
            {resultado.estado === 'sin_conexion'
              ? t('estado.sinConexion', { parche: resultado.build.parche })
              : t('estado.parche', { parche: resultado.build.parche })}
          </p>
          <p className="estadisticas">
            <span>{t('ui.victorias', { porcentaje: (resultado.build.tasaVictoria * 100).toLocaleString('es', { maximumFractionDigits: 1 }) })}</span>
            {' · '}
            <span>{t('ui.partidas', { partidas: resultado.build.partidas })}</span>
          </p>
          {resultado.build.mezclaParches && <p className="nota">{t('ui.mezclaParches')}</p>}

          <h3>{t('ui.runas')}</h3>
          <div className="fila">
            {[resultado.build.runas.estiloPrincipal, resultado.build.runas.estiloSecundario, ...resultado.build.runas.runas].map((id, i) => {
              const r = rec.runas[id];
              return r ? (
                <img key={i} className="icono" src={`${CDN}/img/${r.icono}`} alt={r.nombre} title={r.nombre} />
              ) : (
                <span key={i} className="icono vacio" />
              );
            })}
          </div>

          <h3>{t('ui.hechizos')}</h3>
          <div className="fila">
            {resultado.build.hechizos.map((id) => {
              const h = rec.hechizos[id];
              return h ? <img key={id} className="icono" src={`${CDN}/${v}/img/spell/${h.imagen}`} alt={h.nombre} title={h.nombre} /> : null;
            })}
          </div>

          <h3>{t('ui.objetos')}</h3>
          {(
            [
              ['iniciales', resultado.build.objetosIniciales],
              ['nucleo', resultado.build.nucleo],
              ['botas', resultado.build.botas !== null ? [resultado.build.botas] : []],
              ['situacionales', resultado.build.situacionales],
            ] as const
          ).map(([clave, ids]) => (
            <div key={clave} className="bloque">
              <h4>{t('conjunto.' + clave)}</h4>
              <div className="fila">{ids.map(icono)}</div>
            </div>
          ))}

          <h3>{t('ui.habilidades')}</h3>
          <ol className="habilidades">
            {resultado.build.ordenHabilidades.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ol>

          <button type="button" className="importar" disabled={importacion === 'importando'} onClick={onImportar}>
            {importacion === 'importando' ? t('ui.importando') : t('ui.importar')}
          </button>
          {importacion && importacion !== 'importando' && <p className="resultado-importacion">{mensajeImportacion(importacion)}</p>}
        </>
      )}
    </section>
  );
}
