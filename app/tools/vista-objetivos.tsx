// Herramienta de desarrollo: pinta la barra de objetivos en varios estados (para revisarla en un navegador).
import { createRoot } from 'react-dom/client';
import '../src/renderer/comun/tokens.css';
import '../src/renderer/overlay/panel.css';
import { establecerIdioma, t } from '../src/shared/i18n';
import { BarraObjetivos } from '../src/renderer/overlay/widgets/BarraObjetivos';

establecerIdioma('es');
document.body.style.cssText = 'margin:0;padding:28px;background:#2a3b2f;display:flex;flex-direction:column;gap:22px;align-items:flex-start';
const raiz = document.createElement('div');
raiz.style.cssText = 'display:flex;flex-direction:column;gap:22px;align-items:flex-start';
document.body.appendChild(raiz);
createRoot(raiz).render(
  <>
    <BarraObjetivos
      objetivos={[
        { id: 'larvas', nombre: 'Larvas del Vacío', subtipo: null, aparece: null, disponible: true },
        { id: 'dragon', nombre: 'Dragón', subtipo: t('overlay.dragon.infernal'), aparece: 42, disponible: false },
        { id: 'heraldo', nombre: 'Heraldo', subtipo: null, aparece: 412, disponible: false },
        { id: 'baron', nombre: 'Barón', subtipo: null, aparece: 1170, disponible: false },
      ]}
    />
    <BarraObjetivos
      objetivos={[
        { id: 'dragon', nombre: 'Dragón', subtipo: t('overlay.dragon.oceano'), aparece: null, disponible: true },
        { id: 'baron', nombre: 'Barón', subtipo: null, aparece: 150, disponible: false },
        { id: 'inhibidor', nombre: 'Inhibidor', subtipo: 'MID', aparece: 210, disponible: false, aliado: true },
        { id: 'inhibidor', nombre: 'Inhibidor', subtipo: 'TOP', aparece: 35, disponible: false, aliado: false },
      ]}
    />
    <BarraObjetivos
      objetivos={[
        { id: 'dragon', nombre: 'Dragón', subtipo: t('overlay.dragon.hextech'), aparece: 260, disponible: false },
        { id: 'dragon', nombre: 'Dragón', subtipo: t('overlay.dragon.quimtech'), aparece: 30, disponible: false },
        { id: 'dragon', nombre: 'Dragón', subtipo: t('overlay.dragon.nube'), aparece: 90, disponible: false },
        { id: 'dragon', nombre: 'Dragón', subtipo: t('overlay.dragon.montana'), aparece: null, disponible: true },
        { id: 'anciano', nombre: 'Dragón Anciano', subtipo: null, aparece: 20, disponible: false },
      ]}
    />
  </>,
);
