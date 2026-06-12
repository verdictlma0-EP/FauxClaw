// OpenRouter free tier proxy.
// They have a generous free tier for many models, which we obviously take advantage of with our broke asses.

import { nodeHttps } from '../utils/http.js';

const MODEL_MAP = {
  'claude-sonnet-4-5': 'anthropic/claude-3.5-sonnet:free',
  'claude-haiku-4-5': 'anthropic/claude-3.5-haiku:free',
  'claude-opus-4': 'anthropic/claude-3-opus:free',
  'gpt-4o': 'openai/gpt-4o-mini:free',
  'deepseek-r1': 'deepseek/deepseek-r1:free'
};

export async function openrouterChat(apiKey, body, model) {
  const routerModel = MODEL_MAP[model] || `anthropic/${model}:free`;

  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://fauxclaw.dev',
    'X-Title': 'Fauxclaw'
  };

  const payload = {
    ...body,
    model: routerModel,
    stream: body.stream !== false,
    max_tokens: Math.min(body.max_tokens || 4096, 4096),
    temperature: body.temperature ?? 0.7
  };

  const response = await nodeHttps('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    timeout: parseInt(process.env.FXC_TIMEOUT || '30000')
  });

  return { response, requestId: `or_${Date.now()}`, format: 'sse' };
}
