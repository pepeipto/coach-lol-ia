import { createRoot } from 'react-dom/client';
import { App } from './App';
import { iniciarIdioma } from '../comun/idioma';
import { iniciarTema } from '../comun/tema';
import '../comun/tokens.css';
import './estilos.css';
import './vistas/campeon.css';
import './vistas/vistas.css';
import './vistas/campeones.css';
import './vistas/bienvenida.css';
import './vistas/analisis.css';
import '../overlay/panel.css';
import './tema.css';

iniciarIdioma(window.coach);
iniciarTema(window.coach);
createRoot(document.getElementById('root')!).render(<App />);
