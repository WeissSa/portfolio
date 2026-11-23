import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// Layered Mantine styles (@layer mantine): the unlayered custom P5 CSS always
// wins the cascade, so Mantine can never clobber the diegetic motifs.
import '@mantine/core/styles.layer.css';
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
