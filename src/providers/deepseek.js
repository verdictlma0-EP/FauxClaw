// DeepSeek provider – Anthropic-compatible Messages API
import { nodeHttps } from '../utils/http.js';
import { extractText } from '../utils/helpers.js';

export async function deepseekChat(apiKey, body, model) {
  const cleanModel = model.replace(/^deepseek\//, '');
  
  const messages = body.messages || [];

  const payload = {
    model: cleanModel,
    messages: messages,
    stream: body.stream !== false,
    max_tokens: Math.min(body.max_tokens || 8192, 8192),
    temperature: body.temperature ?? 0.7
  };

  const response = await nodeHttps('https://api.deepseek.com/anthropic/v1/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(payload),
    timeout: parseInt(process.env.FXC_TIMEOUT || '30000')
  });

  // DeepSeek uses Anthropic-compatible API directly, no conversion needed
  return { response, requestId: `deepseek_${Date.now()}`, format: 'sse' };
}
