// FAUXCLAW branding – ASCII text logo and status messages
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Correct path: from src/utils to root package.json
const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8'));
const VERSION = pkg.version || '2.8.3';

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
  \x1b[33m💡\x1b[0m Type /help for commands
`;
}

export function showStartup(port, host, providers) {
  const line1 = `🦞  FAUXCLAW v${VERSION}`;
  const line2 = `▸ Real Claude. Fake Bill.`;
  const line3 = `▸ Proxy: http://${host}:${port}`;
  const line4 = `▸ Providers: ${providers.join(' → ')}`;
  const line5 = `▸ Mode: 🆓 Free tier (no payment required)`;

  const lines = [line1, line2, line3, line4, line5];
  const maxLen = Math.max(...lines.map(l => l.length)) + 4;
  const border = '─'.repeat(Math.min(maxLen, 60));

  let box = `╭${border}╮\n`;
  for (const l of lines) {
    const padded = l.padEnd(maxLen - 2);
    box += `│ ${padded} │\n`;
  }
  box += `╰${border}╯`;

  return `\x1b[35m${box}\x1b[0m\n\n\x1b[32m✓\x1b[0m Fauxclaw is now scratching your AI itch...\n`;
}

export function showChatHeader() {
  return `
\x1b[35m${logo}\x1b[0m

\x1b[36m💬 Fauxclaw Interactive Chat\x1b[0m
\x1b[33mCommands: /exit, /clear, /status, /model <name>\x1b[0m
`;
}

export function showStatusReport(providerStatus, chain, stats) {
  let output = '\n╔═══════════════════════════════════════════════════╗\n';
  output += '║  🦞  FAUXCLAW STATUS REPORT                       ║\n';
  output += '╚═══════════════════════════════════════════════════╝\n\n';
  output += 'PROVIDERS\n─────────────────────────────────────────────────────\n';
  for (const [id, info] of Object.entries(providerStatus)) {
    const icon = info.configured ? (info.active ? '✅' : '⚙️') : '❌';
    const status = info.configured ? (info.active ? 'configured' : 'needs refresh') : 'not configured';
    output += `  ${icon} ${info.name.padEnd(14)} ${status}\n`;
  }
  output += `\nFALLBACK CHAIN\n─────────────────────────────────────────────────────\n  ${chain.join(' → ') || '(none)'}\n`;
  output += `\nPERFORMANCE\n─────────────────────────────────────────────────────\n  Requests:     ${stats.totalRequests}\n  Success:      ${stats.successRate}\n  Avg latency:  ${stats.avgLatency}\n\n`;
  output += '"Fake it till you make it, but today you made it." 🦞\n';
  return output;
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
  showStatusReport,
  showError,
  showSuccess,
  showWarning,
  showInfo,
  logo
};
