#!/usr/bin/env node

import { startServer } from '../src/server.js';
import { loadConfig } from '../src/config.js';
import { showBranding, showError } from '../src/utils/branding.js';

const cmd = process.argv[2];

async function main() {
  if (cmd && cmd !== 'status' && cmd !== 'metrics' && cmd !== 'help' && cmd !== 'chat' && cmd !== 'c' && cmd !== 'doctor' && cmd !== '-h' && cmd !== '--help') {
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
      
    case 'doctor':
      const { runDoctor } = await import('../src/doctor.js');
      await runDoctor();
      break;
      
    case 'purge':
      const { sessionStore } = await import('../src/session.js');
      const n = sessionStore.purge();
      console.log(` Purged ${n} expired sessions`);
      break;
      
    case 'chat':
    case 'c':
      const { default: chat } = await import('../src/chat.js');
      break;
      
    case 'start':
    case undefined:
      const config = loadConfig();
      const hasAny = config.kiro || config.openrouter || config.iflow ||
                     config.nvidia || config.groq || config.gemini ||
                     config.deepseek || config.mistral || config.ollama;
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
\x1b[35m╔══════════════════════════════════════════════════════════════╗
║     FAUXCLAW - Real Claude. Fake Bill.                       ║
╚══════════════════════════════════════════════════════════════╝\x1b[0m

\x1b[36mCOMMANDS:\x1b[0m
  \x1b[32mfxc setup\x1b[0m            Interactive provider setup
  \x1b[32mfxc start\x1b[0m            Start proxy server (for Claude Code)
  \x1b[32mfxc chat\x1b[0m / \x1b[32mfxc c\x1b[0m     Interactive chat terminal
  \x1b[32mfxc status\x1b[0m           Show token expiry and provider health
  \x1b[32mfxc metrics\x1b[0m          Performance dashboard
  \x1b[32mfxc doctor\x1b[0m           Diagnose system issues
  \x1b[32mfxc purge\x1b[0m            Delete expired sessions
  \x1b[32mfxc help\x1b[0m             Show this help message

\x1b[36mEXAMPLES:\x1b[0m
  \x1b[33m$ fxc setup && fxc start\x1b[0m
  \x1b[33m$ fxc chat\x1b[0m
  \x1b[33m$ fxc doctor\x1b[0m
  \x1b[33m$ fxc metrics\x1b[0m

\x1b[36mENVIRONMENT:\x1b[0m
  FXC_PORT            Port to listen on (default: 8083)
  FXC_HOST            Bind address (default: 127.0.0.1)
  FXC_API_KEY         API key for authentication (optional)
  FXC_LOG             Log level: debug, info, warn, error

\x1b[33m"Fake it till you make it, but read the docs first." \x1b[0m
`);
      break;
      
    default:
      console.log(`\n\x1b[31m❌ Unknown command: ${cmd}\x1b[0m`);
      console.log(`\x1b[36mTry \`fxc help\` for available commands.\x1b[0m\n`);
      process.exit(1);
  }
}

main().catch(err => {
  console.error(`\n\x1b[31m💀 Fatal error: ${err.message}\x1b[0m\n`);
  process.exit(1);
});
