// Shows current provider status, token expiry, etc.

import { loadConfig } from './config.js';
import { getAvailableProviders } from './providers/index.js';
import { showStatusReport } from './utils/branding.js';

export function showStatus() {
  const config = loadConfig();
  const providers = getAvailableProviders(config);

  const providerStatus = {};

  // Kiro
  if (config.kiro) {
    const expired = config.kiro.expiresAt && Date.now() > config.kiro.expiresAt;
    providerStatus.kiro = {
      active: !expired && !!config.kiro.accessToken,
      configured: true,
      message: expired ? 'expired (will auto‑refresh)' : `valid until ${new Date(config.kiro.expiresAt).toLocaleTimeString()}`
    };
  } else {
    providerStatus.kiro = { active: false, configured: false, message: 'not configured' };
  }

  // OpenRouter
  providerStatus.openrouter = {
    active: !!config.openrouter?.apiKey,
    configured: !!config.openrouter?.apiKey,
    message: config.openrouter?.apiKey ? 'api key set' : 'not configured'
  };

  // iFlow
  providerStatus.iflow = {
    active: !!config.iflow?.token,
    configured: !!config.iflow?.token,
    message: config.iflow?.token ? 'token set' : 'not configured'
  };

  const stats = {
    totalRequests: 0,    // we don't persist metrics, so just show 0
    successRate: 0,
    avgLatency: 0
  };

  showStatusReport(providerStatus, providers, stats);
}
