#!/usr/bin/env node

// Fauxclaw CLI – yay say thanks to me having no life
// really, it is just plain js, like my life.

import { startServer } from '../src/server.js';
import { loadConfig } from '../src/config.js';
import { showBranding, showError } from '../src/utils/branding.js';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cmd = process.argv[2];

async function main() {
  // Only show big logo for interactive commands
  if (cmd && cmd !== 'status' && cmd !== 'metrics' && cmd !== 'help') {
    console.log(showBranding());
  }

  switch (cmd) {
    case 'setup':
      const { setupWizard } = await import('../scripts/setup.js');
      await setupWizard();
      break;
    case 'status':
      const { showStatus } = await import('../src/status.js');
      showStatus();
      break;
    case 'metrics':
      const { showMetrics } = await import('../src/utils/metrics.js');
      showMetrics();
      break;
    case 'purge':
      const { sessionStore } = await import('../src/session.js');
      const n = sessionStore.purge();
      console.log(`Purged ${n} expired sessions`);
      break;
    case 'start':
    case undefined:
      const config = loadConfig();
      const hasAny = config.kiro || config.openrouter || config.iflow;
      if (!hasAny) {
        showError('No providers configured. Run `fxc setup` first.\n  "Even a faux claw needs something to scratch."');
        process.exit(1);
      }
      await startServer(config);
      break;
    case 'help':
    case '-h':
    case '--help':
      console.log(`
🦞 FAUXCLAW – Real Claude.

Usage:
  fxc setup            Interactive provider setup
  fxc start            Start proxy server
  fxc status           Show token expiry and provider health
  fxc metrics          Performance dashboard
  fxc purge            Delete expired sessions
  fxc help             This message

Env:
  FXC_PORT             Port (default 8083)
  FXC_HOST             Bind address (default 127.0.0.1)
  FXC_API_KEY          Require this key in X-Proxy-Key header
  FXC_LOG              debug|info|warn|error
`);
      break;
    default:
      console.log(`Unknown command: ${cmd}., go get a life loser, or call 988 and try fxc help`);
  }
}

main().catch(err => {
  console.error(`What the heck are you doing? Go SDIYBT or something, it cannot be that hard, you even got a ${err.message}`);
  process.exit(1);
});
