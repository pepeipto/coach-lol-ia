// Vista de desarrollo de la intro con el logo (IntroLogo.tsx), en bucle y sin Electron; ver vista-intro.html.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { IntroLogo } from '../src/renderer/principal/IntroLogo';
import '../src/renderer/comun/tokens.css';
import '../src/renderer/principal/intro.css';

function Bucle() {
  const [n, setN] = useState(0);
  const unaVez = new URLSearchParams(location.search).has('una');
  const [fin, setFin] = useState(false);
  return (
    <div style={{ height: '100vh', display: 'grid', placeItems: 'center', color: '#8b97b8', fontFamily: 'sans-serif' }}>
      <p>La app aparece aquí detrás.</p>
      {!fin && (
        <IntroLogo
          key={n}
          alTerminar={() => (unaVez ? setFin(true) : setTimeout(() => setN((x) => x + 1), 600))}
        />
      )}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Bucle />);
