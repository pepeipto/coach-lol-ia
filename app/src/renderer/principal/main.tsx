import { createRoot } from 'react-dom/client';
import { t } from '../../shared/i18n';

createRoot(document.getElementById('root')!).render(
  <main>
    <h1>{t('app.titulo')}</h1>
    <p>{t('estado.esperandoCliente')}</p>
    <small>{t('legal.aviso')}</small>
  </main>,
);
