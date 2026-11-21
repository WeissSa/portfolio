import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root missing from index.html');
}

// createRoot replaces any server/build-time static mirror inside #root.
createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
