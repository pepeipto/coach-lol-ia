import { t } from '../../../shared/i18n';
import type { AjustesVoz } from '../../../shared/tiposApp';
import { GRUPOS_VOZ, NIVELES_DETALLE, nivelDeTipos, tiposDeNivel, type GrupoVoz } from '../../../shared/vozCategorias';
import { Interruptor, Pestanas } from '../../comun/componentes';

/**
 * 3.1: qué dice la voz. Arriba, el «Nivel de detalle» (Básico / Normal / Completo), que enciende un conjunto de
 * categorías; debajo, cada categoría con su interruptor, agrupadas. Si el usuario toca una categoría y ya no coincide
 * con ningún nivel, el nivel pasa a «personalizado» (ninguna pestaña marcada).
 */
export function CategoriasVoz({ voz, alCambiar }: { voz: AjustesVoz; alCambiar(tipos: AjustesVoz['tipos']): void }) {
  const nivel = nivelDeTipos(voz.tipos);
  const deshabilitado = !voz.activa;
  return (
    <div className="vo-categorias-voz">
      <p className="vo-subtitulo">{t('overlay.config.nivelDetalle')}</p>
      <Pestanas
        etiqueta={t('overlay.config.nivelDetalle')}
        activa={nivel}
        opciones={NIVELES_DETALLE.map((n) => ({ id: n, texto: t(`overlay.config.nivelDetalle.${n}`) }))}
        alCambiar={(id) => !deshabilitado && alCambiar(tiposDeNivel(id as (typeof NIVELES_DETALLE)[number]))}
      />
      <p className="texto-secundario">{t(`overlay.config.nivelDetalle.${nivel === 'personalizado' ? 'personalizado' : `${nivel}Desc`}`)}</p>
      <p className="vo-subtitulo">{t('overlay.config.tipos')}</p>
      {(Object.keys(GRUPOS_VOZ) as GrupoVoz[]).map((grupo) => (
        <fieldset key={grupo} className="vo-grupo-voz">
          <legend className="vo-grupo-voz-titulo">{t(`overlay.config.grupoVoz.${grupo}`)}</legend>
          <div className="lista-interruptores">
            {GRUPOS_VOZ[grupo].map((tipo) => (
              <Interruptor
                key={tipo}
                etiqueta={t(`overlay.config.tipo.${tipo}`)}
                marcado={voz.tipos[tipo]}
                deshabilitado={deshabilitado}
                alCambiar={(v) => alCambiar({ ...voz.tipos, [tipo]: v })}
              />
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
