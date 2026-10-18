import { createRoot } from 'react-dom/client';
import { App } from './App';
import '../comun/tokens.css';
import './estilos.css';
import './vistas/campeon.css';
import './vistas/vistas.css';
import '../overlay/panel.css';

createRoot(document.getElementById('root')!).render(<App />);
