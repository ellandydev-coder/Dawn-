import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProviders } from '@app/providers/AppProviders';
import App from './App';
import './index.css';

/*
 * ⚙️  BOOTSTRAP DE REGISTRIES (auto-descubrimiento)
 * -------------------------------------------------
 * Cada import de un `bootstrap.ts` ejecuta el descubrimiento
 * por Vite glob de una feature auto-registrable.
 *
 * Debe ejecutarse ANTES de renderizar la app para que los
 * registries estén poblados cuando los componentes los lean.
 *
 * A medida que migremos más dominios al framework de registry
 * sus bootstraps se añaden aquí también.
 */
import '@features/preferences/registry/bootstrap';
import '@shared/components/icons/registry/bootstrap';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>
);