// Provider router with fallback chain because why not
// Order: Kiro (free Claude) → OpenRouter (free tier) → iFlow (Chinese free, thank you so much!)

import { kiroChat, kiroGetToken, kiroRefreshToken } from './kiro.js';
import { openrouterChat } from './openrouter.js';
import { iflowChat } from './iflow.js';
import { CircuitBreaker } from '../circuitbreaker.js';
import { loadConfig, saveConfig } from '../config.js';
import { logger } from '../utils/logger.js';
import { updateProviderMetrics } from '../utils/metrics.js';

const breakers = {
  kiro: new CircuitBreaker('kiro'),
  openrouter: new CircuitBreaker('openrouter'),
  iflow: new CircuitBreaker('iflow')
};

export async function routeRequest(config, body, model, sessionId = null, retry = 0) {
  const providers = getAvailableProviders(config);
  const errors = [];
  const MAX_RETRIES = 2;

  for (const provider of providers) {
    const cb = breakers[provider];
    if (cb.state === 'OPEN') {
      logger.warn(`Skipping ${provider} – circuit breaker open`);
      errors.push(`${provider}: circuit open`);
      continue;
    }

    try {
      logger.info(`🦞 Trying ${provider} (attempt ${retry + 1})`);
      const start = Date.now();
      let result;

      if (provider === 'kiro') {
        let token = await kiroGetToken(config);
        if (!token) {
          token = await kiroRefreshToken(config);
          if (!token) throw new Error('No Kiro token – run fxc setup');
        }
        result = await cb.call(() => kiroChat(token, body, model, sessionId));
      } else if (provider === 'openrouter') {
        const key = config.openrouter?.apiKey;
        if (!key) throw new Error('OpenRouter API key missing');
        result = await cb.call(() => openrouterChat(key, body, model));
      } else if (provider === 'iflow') {
        const token = config.iflow?.token;
        if (!token) throw new Error('iFlow token missing');
        result = await cb.call(() => iflowChat(token, body, model));
      } else {
        continue;
      }

      updateProviderMetrics(provider, true, Date.now() - start);
      return result;
    } catch (err) {
      logger.warn(`${provider} failed: ${err.message}`);
      errors.push(`${provider}: ${err.message}`);
      updateProviderMetrics(provider, false, 0);
      // Special handling: if Kiro token expired, refresh and retry once
      if (provider === 'kiro' && err.message.includes('token') && retry < MAX_RETRIES) {
        logger.info('Refreshing Kiro token and retrying...');
        await kiroRefreshToken(config);
        return routeRequest(config, body, model, sessionId, retry + 1);
      }
    }
  }

  throw new Error(`All providers failed: ${errors.join(', ')}`);
}

export function getAvailableProviders(config) {
  const chain = [];
  if (config.kiro?.accessToken || config.kiro?.refreshToken) chain.push('kiro');
  if (config.openrouter?.apiKey) chain.push('openrouter');
  if (config.iflow?.token) chain.push('iflow');
  return chain;
}
