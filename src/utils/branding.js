// FAUXCLAW branding – ASCII text logo and status messages

const logo = `
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║     ███████╗ █████╗ ██╗   ██╗██╗  ██╗ ██████╗██╗      █████╗ ██╗    ██╗       ║
║     ██╔════╝██╔══██╗██║   ██║╚██╗██╔╝██╔════╝██║     ██╔══██╗██║    ██║       ║
║     █████╗  ███████║██║   ██║ ╚███╔╝ ██║     ██║     ███████║██║ █╗ ██║       ║
║     ██╔══╝  ██╔══██║██║   ██║ ██╔██╗ ██║     ██║     ██╔══██║██║███╗██║       ║
║     ██║     ██║  ██║╚██████╔╝██╔╝ ██╗╚██████╗███████╗██║  ██║╚███╔███╔╝       ║
║     ╚═╝     ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝ ╚═════╝╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝        ║
║                                                                               ║
║                          Real Claude. Fake Bill.                              ║
║                    "Fake it till you make it, but today you made it."         ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
`;

export function showBranding() {
  return `
\x1b[35m${logo}\x1b[0m

  \x1b[32m✓\x1b[0m Ready to scratch some AI itches
  \x1b[36m→\x1b[0m Tagline: "Real Claude. Fake Bill."
  \x1b[33m\x1b[0m Type /help for commands
`;
}

export function showStartup(port, host, providers) {
  return `
\x1b[35m╭─────────────────────────────────────────────────╮
│     FAUXCLAW v2.0.0                           │
│  ▸ Real Claude. Fake Bill.                     │
│  ▸ Proxy: http://${host}:${port}                │
│  ▸ Providers: ${providers.join(' → ')}        │
│  ▸ Mode:  Free tier (no payment required)    │
╰─────────────────────────────────────────────────╯\x1b[0m

\x1b[32m✓\x1b[0m Fauxclaw is now scratching your AI itch...
`;
}

export function showChatHeader() {
  return `
\x1b[35m${logo}\x1b[0m

\x1b[36m💬 Fauxclaw Interactive Chat\x1b[0m
\x1b[33mCommands: /exit, /clear, /status, /help\x1b[0m

`;
}

export function showError(msg) {
  console.error(`\n  \x1b[31m❌\x1b[0m ${msg}\n`);
}

export function showSuccess(msg) {
  console.log(`\n  \x1b[32m✓\x1b[0m ${msg}\n`);
}

export function showWarning(msg) {
  console.log(`\n  \x1b[33m⚠\x1b[0m ${msg}\n`);
}

export function showInfo(msg) {
  console.log(`\n  \x1b[36m→\x1b[0m ${msg}\n`);
}

export default {
  showBranding,
  showStartup,
  showChatHeader,
  showError,
  showSuccess,
  showWarning,
  showInfo,
  logo
};
