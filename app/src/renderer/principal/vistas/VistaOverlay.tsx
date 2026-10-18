import { Bell, Crown, Eye, Move, Pin, Volume2 } from 'lucide-react';
import { t } from '../../../shared/i18n';
import type { Plan, TipoAviso } from '../../../shared/tiposApp';
import { Avisos } from '../../overlay/Avisos';
import { Panel } from '../../overlay/Panel';
import { Aviso, Boton, Esqueleto, Interruptor, Tarjeta } from '../../comun/componentes';
import { CabeceraVista } from './CabeceraVista';
import { useAjustes, useMoverOverlay } from './useAjustes';

const AVISOS: TipoAviso[] = ['compra', 'habilidad', 'objetivo', 'vision', 'fase'];

/** Datos de ejemplo para la vista previa, construidos con las mismas plantillas que usa la partida. */
const PANEL_EJEMPLO = {
  proximaCompra: t('panel.compra', { objeto: t('vistaOverlay.ejemploObjeto'), oro: 450 }),
  proximoObjetivo: t('aviso.objetivoPronto', { objetivo: t('objetivo.dragon'), segundos: 42 }),
};
const AVISO_EJEMPLO = [{ id: 0, texto: t('aviso.habilidad', { nivel: 6, habilidad: 'R' }), tipo: 'habilidad' as const }];

export function VistaOverlay({ plan, alVerPremium }: { plan: Plan; alVerPremium: () => void }) {
  const { ajustes, cambiar, guardado } = useAjustes();
  const [moviendo, alternarMover] = useMoverOverlay();

  return (
    <div className="vista-ajustes">
      <CabeceraVista titulo={t('nav.overlay')} descripcion={t('vistaOverlay.desc')} guardado={guardado} />

      {plan === 'gratis' && (
        <Aviso
          tono="info"
          accion={
            <Boton variante="secundario" className="boton-pequeno" onClick={alVerPremium}>
              <Crown size={14} aria-hidden="true" />
              {t('banner.ver')}
            </Boton>
          }
        >
          <strong>{t('premium.coachEsPremium')}</strong>. {t('premium.coachEsPremiumDesc')}
        </Aviso>
      )}

      <div className="rejilla-overlay">
        <Tarjeta titulo={t('vistaOverlay.previa')} icono={<Eye size={15} />} className="tarjeta-previa">
          <p className="texto-secundario">{t('vistaOverlay.previaDesc')}</p>
          <div className="escena-previa" aria-hidden="true">
            <div className="ov-panel">
              <Panel panel={PANEL_EJEMPLO} />
              <Avisos avisos={AVISO_EJEMPLO} estaticos />
            </div>
          </div>
        </Tarjeta>

        <Tarjeta titulo={t('vistaOverlay.posicion')} icono={<Move size={15} />} className="tarjeta-posicion">
          <p className="texto-secundario">
            {t('vistaOverlay.posicionDesc', { tecla: ajustes?.teclaOverlay || t('ajustes.teclaSinDefinir') })}
          </p>
          {moviendo && <Aviso tono="aviso">{t('vistaOverlay.moviendo')}</Aviso>}
          <Boton variante={moviendo ? 'secundario' : 'primario'} onClick={alternarMover} className="boton-mover">
            {moviendo ? <Pin size={16} aria-hidden="true" /> : <Move size={16} aria-hidden="true" />}
            {moviendo ? t('ajustes.fijarOverlay') : t('ajustes.moverOverlay')}
          </Boton>
        </Tarjeta>

        <Tarjeta titulo={t('ajustes.avisos')} icono={<Bell size={15} />} className="tarjeta-avisos">
          <p className="texto-secundario">{t('ajustes.avisosDesc')}</p>
          <div className="lista-interruptores">
            {ajustes
              ? AVISOS.map((a) => (
                  <Interruptor
                    key={a}
                    etiqueta={t('ajustes.aviso.' + a)}
                    descripcion={t(`ajustes.aviso.${a}Desc`)}
                    marcado={ajustes.avisos[a]}
                    alCambiar={(v) => cambiar({ ...ajustes, avisos: { ...ajustes.avisos, [a]: v } })}
                  />
                ))
              : AVISOS.map((a) => <Esqueleto key={a} alto={38} />)}
          </div>
        </Tarjeta>

        <Tarjeta titulo={t('ajustes.vozTitulo')} icono={<Volume2 size={15} />} className="tarjeta-voz">
          {ajustes ? (
            <Interruptor
              etiqueta={t('ajustes.voz')}
              descripcion={t('ajustes.vozDesc')}
              marcado={ajustes.voz}
              alCambiar={(v) => cambiar({ ...ajustes, voz: v })}
            />
          ) : (
            <Esqueleto alto={38} />
          )}
        </Tarjeta>
      </div>
    </div>
  );
}
