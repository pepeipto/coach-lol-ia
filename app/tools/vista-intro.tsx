// Vista de desarrollo de la intro con el logo (IntroLogo.tsx), sin Electron; ver vista-intro.html.
// Detrás va una captura real de la app para ver cómo se enfoca al final. ?una = solo una vez.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { IntroLogo } from '../src/renderer/principal/IntroLogo';
import '../src/renderer/comun/tokens.css';
import '../src/renderer/principal/intro.css';

const CAPTURA = new URL('../../web/public/capturas/campeon.webp', import.meta.url).href;

function Bucle() {
  const [n, setN] = useState(0);
  const unaVez = new URLSearchParams(location.search).has('una');
  const [fin, setFin] = useState(false);
  return (
    <>
      <div className="app" style={{ height: '100vh', background: `#0a0e1a url(${CAPTURA}) center / cover no-repeat` }} />
      {!fin && (
        <IntroLogo key={n} alTerminar={() => (unaVez ? setFin(true) : setTimeout(() => setN((x) => x + 1), 900))} />
      )}
    </>
  );
}

createRoot(document.getElementById('root')!).render(<Bucle />);
