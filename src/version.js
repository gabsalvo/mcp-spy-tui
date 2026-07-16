import { createRequire } from 'module';

// Single source of truth for the version, so --version and /api/health can
// never drift from what was actually published.
const require = createRequire(import.meta.url);
export const { version } = require('../package.json');
