// The fancy ASCII lobster and status messages people make for some reason.

export const logo = `
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     ▄▄▄▄▄▄▄▄▄▄▄  ▄▄▄▄▄▄▄▄▄▄▄  ▄▄▄▄▄▄▄▄▄▄▄  ▄▄▄▄▄▄▄▄▄▄▄     ║
║    ▐░░░░░░░░░░░▌▐░░░░░░░░░░░▌▐░░░░░░░░░░░▌▐░░░░░░░░░░░▌    ║
║    ▐░█▀▀▀▀▀▀▀█░▌▐░█▀▀▀▀▀▀▀█░▌▐░█▀▀▀▀▀▀▀█░▌▐░█▀▀▀▀▀▀▀█░▌    ║
║    ▐░▌       ▐░▌▐░▌       ▐░▌▐░▌       ▐░▌▐░▌       ▐░▌    ║
║    ▐░█▄▄▄▄▄▄▄█░▌▐░█▄▄▄▄▄▄▄█░▌▐░█▄▄▄▄▄▄▄█░▌▐░█▄▄▄▄▄▄▄█░▌    ║
║    ▐░░░░░░░░░░░▌▐░░░░░░░░░░░▌▐░░░░░░░░░░░▌▐░░░░░░░░░░░▌    ║
║    ▐░█▀▀▀▀▀▀▀█░▌▐░█▀▀▀▀▀▀▀█░▌▐░█▀▀▀▀▀▀▀█░▌▐░█▀▀▀▀▀▀▀█░▌    ║
║    ▐░▌       ▐░▌▐░▌       ▐░▌▐░▌       ▐░▌▐░▌       ▐░▌    ║
║    ▐░▌       ▐░▌▐░▌       ▐░▌▐░█▄▄▄▄▄▄▄█░▌▐░█▄▄▄▄▄▄▄█░▌    ║
║    ▐░▌       ▐░▌▐░▌       ▐░▌▐░░░░░░░░░░░▌▐░░░░░░░░░░░▌    ║
║     ▀         ▀  ▀         ▀  ▀▀▀▀▀▀▀▀▀▀▀  ▀▀▀▀▀▀▀▀▀▀▀     ║
║                                                               ║
║              ╔═══════════════════════════════╗               ║
║              ║    FAUXCLAW - v2.0.0         ║               ║
║              ║    "Real Claude, Fake Bill"   ║               ║
║              ╚═══════════════════════════════╝               ║
║                                                               ║
║         🦞  Free AI Proxy for Claude Code   🦞              ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`;

export function showBranding() {
  // I added a little color using ANSI codes – hope your terminal likes them ;D
  return `\x1b[35m${logo}\x1b[0m\n  \x1b[32m✓\x1b[0m Ready to scratch some AI itches\n  \x1b[36m→\x1b[0m Tagline: "Real Claude. Fake Bill. We're always following Frank Abagnale"\n`;
}

export function showStartup(port, host, providers) {
  return `
\x1b[35m╭─────────────────────────────────────────────────╮
│  🦞  FAUXCLAW v2.0.0                           │
│  ▸ Real Claude. Fake Bill.                     │
│  ▸ Proxy: http://${host}:${port}                │
│  ▸ Providers: ${providers.join(' → ')}        │
│  ▸ Mode: Free tier (no payment required)    │
╰─────────────────────────────────────────────────╯\x1b[0m

\x1b[32m✓\x1b[0m Fauxclaw is now scratching your AI itch...
`;
}

export function showError(msg) {
  console.error(`\n  \x1b[31m❌\x1b[0m ${msg}\n`);
}

export function showSuccess(msg) {
  console.log(`\n  \x1b[32m✓\x1b[0m ${msg}\n`);
}
