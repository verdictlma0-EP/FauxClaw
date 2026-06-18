// Provider router with fallback chain and prefix-based routing.
// If the model starts with a known prefix (e.g., "groq/"), it routes directly to that provider.
// Otherwise, it falls back to the chain: Kiro -> OpenRouter -> iFlow -> NVIDIA -> Groq -> Gemini -> DeepSeek -> Mistral -> Ollama

import { kiroChat, kiroGetToken } from './kiro.js';
import { openrouterChat } from './openrouter.js';
import { iflowChat } from './iflow.js';
import { nvidiaChat } from './nvidia.js';
import { groqChat } from './groq.js';
import { geminiChat } from './gemini.js';
import { deepseekChat } from './deepseek.js';
import { mistralChat } from './mistral.js';
import { ollamaChat } from './ollama.js';
import { CircuitBreaker } from '../circuitbreaker.js';
import { logger } from '../utils/logger.js';
import { updateProviderMetrics } from '../utils/metrics.js';

const breakers = {
  kiro: new CircuitBreaker('kiro'),
  openrouter: new CircuitBreaker('openrouter'),
  iflow: new CircuitBreaker('iflow'),
  nvidia: new CircuitBreaker('nvidia'),
  groq: new CircuitBreaker('groq'),
  gemini: new CircuitBreaker('gemini'),
  deepseek: new CircuitBreaker('deepseek'),
  mistral: new CircuitBreaker('mistral'),
  ollama: new CircuitBreaker('ollama')
};

// Kiro pulls a fresh (possibly auto-refreshed) token out of config instead
// of a static credential, so it can't use the generic creds.apiKey path below.
async function callKiro(config, body, model, sessionId) {
  const token = await kiroGetToken(config);
  if (!token) throw new Error('Kiro token missing or refresh failed - run fxc setup');
  return kiroChat(token, body, model, sessionId);
}

// Map of provider prefixes to their chat functions and config keys
const providerMap = {
  kiro: { fn: null, configKey: 'kiro', needs: ['refreshToken'] },
  openrouter: { fn: openrouterChat, configKey: 'openrouter', needs: ['apiKey'] },
  iflow: { fn: iflowChat, configKey: 'iflow', needs: ['token'] },
  nvidia: { fn: nvidiaChat, configKey: 'nvidia', needs: ['apiKey'] },
  groq: { fn: groqChat, configKey: 'groq', needs: ['apiKey'] },
  gemini: { fn: geminiChat, configKey: 'gemini', needs: ['apiKey'] },
  deepseek: { fn: deepseekChat, configKey: 'deepseek', needs: ['apiKey'] },
  mistral: { fn: mistralChat, configKey: 'mistral', needs: ['apiKey'] },
  ollama: { fn: ollamaChat, configKey: 'ollama', needs: ['baseUrl'] }
};

async function checkResponse(resultPromise) {
  const result = await resultPromise;
  const res = result.response;
  if (res && res.ok === false && res.statusCode) {
    let errText = '';
    try {
      for await (const chunk of res) errText += chunk;
    } catch {
      // best effort - some bodies aren't readable twice or at all
    }
    throw new Error(`HTTP ${res.statusCode}${errText ? `: ${errText.slice(0, 200)}` : ''}`);
  }
  return result;
}

function callProvider(provider, config, creds, body, model, sessionId) {
  if (provider === 'kiro') return checkResponse(callKiro(config, body, model, sessionId));
  if (provider === 'ollama') return checkResponse(ollamaChat(creds.baseUrl || 'http://localhost:11434', body, model));
  if (provider === 'iflow') return checkResponse(iflowChat(creds.token, body, model));
  return checkResponse(providerMap[provider].fn(creds.apiKey, body, model));
}

function pickDirectProvider(model) {
  const prefixMatch = model.match(/^([a-zA-Z0-9_]+)\//);
  if (!prefixMatch) return null;
  return providerMap[prefixMatch[1]] ? prefixMatch[1] : null;
}

function checkCreds(config, provider) {
  const providerConfig = providerMap[provider];
  const creds = config[providerConfig.configKey];
  if (!creds || providerConfig.needs.some(need => !creds[need])) return null;
  return creds;
}

export async function routeRequest(config, body, model, sessionId = null) {
  const directProvider = pickDirectProvider(model);

  // A model with a recognized prefix (e.g. "groq/llama-3.3-70b") routes
  // straight to that provider and never falls back to the chain - the
  // user asked for it explicitly, so a silent swap would be surprising.
  if (directProvider) {
    const provider = directProvider;
    const cb = breakers[provider];
    const creds = checkCreds(config, provider);
    if (!creds) {
      throw new Error(`Provider "${provider}" is not configured. Run fxc setup to add credentials.`);
    }
    if (cb.state === 'OPEN') {
      throw new Error(`Provider "${provider}" is temporarily unavailable (circuit breaker open)`);
    }

    try {
      logger.info(`Direct routing to ${provider} (via model prefix)`);
      const start = Date.now();
      const result = await cb.call(() => callProvider(provider, config, creds, body, model, sessionId));
      updateProviderMetrics(provider, true, Date.now() - start);
      return { ...result, provider };
    } catch (err) {
      logger.error(`Direct provider ${provider} failed: ${err.message}`);
      throw err;
    }
  }

  // No prefix - walk the fallback chain in priority order
  const providers = getAvailableProviders(config);
  if (providers.length === 0) {
    throw new Error('No providers configured. Run fxc setup first.');
  }
  const errors = [];

  for (const provider of providers) {
    const cb = breakers[provider];
    if (cb.state === 'OPEN') {
      logger.warn(`Skipping ${provider} - circuit breaker open`);
      errors.push(`${provider}: circuit open`);
      continue;
    }

    const creds = checkCreds(config, provider);
    if (!creds) {
      errors.push(`${provider}: missing credentials`);
      continue;
    }

    try {
      logger.info(`Trying ${provider}`);
      const start = Date.now();
      const result = await cb.call(() => callProvider(provider, config, creds, body, model, sessionId));
      updateProviderMetrics(provider, true, Date.now() - start);
      return { ...result, provider };
    } catch (err) {
      logger.warn(`${provider} failed: ${err.message}`);
      errors.push(`${provider}: ${err.message}`);
      updateProviderMetrics(provider, false, 0);
    }
  }

  throw new Error(`All providers failed: ${errors.join(', ')}`);
}

export function getAvailableProviders(config) {
  const chain = [];
  if (config.kiro?.refreshToken) chain.push('kiro');
  if (config.openrouter?.apiKey) chain.push('openrouter');
  if (config.iflow?.token) chain.push('iflow');
  if (config.nvidia?.apiKey) chain.push('nvidia');
  if (config.groq?.apiKey) chain.push('groq');
  if (config.gemini?.apiKey) chain.push('gemini');
  if (config.deepseek?.apiKey) chain.push('deepseek');
  if (config.mistral?.apiKey) chain.push('mistral');
  if (config.ollama?.baseUrl) chain.push('ollama');
  return chain;
}
