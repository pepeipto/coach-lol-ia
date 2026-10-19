import { createRoot } from 'react-dom/client';
import { Overlay } from './Overlay';
import { iniciarIdioma } from '../comun/idioma';
import '../comun/tokens.css';
import './panel.css';
import './estilos.css';

iniciarIdioma(window.coachOverlay);
createRoot(document.getElementById('root')!).render(<Overlay />);
