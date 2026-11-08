import { createMockAdapter } from './mockAdapter';
import { createSpacetimeAdapter } from './spacetimeAdapter';

// Single adapter composition point. VITE_DATA_MODE=live connects to SpacetimeDB; anything else is mock.
const env = import.meta.env;

export const dataAdapter =
  env.VITE_DATA_MODE === 'live'
    ? createSpacetimeAdapter({
        uri: env.VITE_SPACETIME_URI,
        db: env.VITE_SPACETIME_DB || 'patient-zero-db',
      })
    : createMockAdapter();
