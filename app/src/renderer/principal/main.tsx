import { createRoot } from 'react-dom/client';
import { App } from './App';
import { iniciarIdioma } from '../comun/idioma';
import '../comun/tokens.css';
import './estilos.css';
import './vistas/campeon.css';
import './vistas/vistas.css';
import './vistas/campeones.css';
import './vistas/bienvenida.css';
import '../overlay/panel.css';

iniciarIdioma(window.coach);
createRoot(document.getElementById('root')!).render(<App />);
