// OpenRouter provider – free tier models
import { nodeHttps } from '../utils/http.js';
import { extractText } from '../utils/helpers.js';

// Map user-friendly model names to working OpenRouter free models
const MODEL_MAP = {
  'claude-sonnet-4-5': 'deepseek/deepseek-r1',          // changed from anthropic/claude-3.5-sonnet:free
  'claude-haiku-4-5': 'google/gemini-2.0-flash-lite-001',
  'claude-opus-4': 'openai/gpt-4o-mini',
  'gpt-4o': 'openai/gpt-4o-mini',
  'deepseek-r1': 'deepseek/deepseek-r1',
  'gemini-flash': 'google/gemini-2.0-flash-lite-001'
};

export async function openrouterChat(apiKey, body, model) {
  // Map the model to a working free model
  const routerModel = MODEL_MAP[model] || 'deepseek/deepseek-r1';

  const messages = body.messages?.map(m => ({
    role: m.role,
    content: extractText(m.content)
  })) || [];

  if (body.system && messages.length && messages[0].role !== 'system') {
    messages.unshift({ role: 'system', content: body.system });
  }

  const payload = {
    model: routerModel,
    messages,
    stream: body.stream !== false,
    max_tokens: Math.min(body.max_tokens || 4096, 4096),
    temperature: body.temperature ?? 0.7
  };

  const response = await nodeHttps('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://fauxclaw.dev',
      'X-Title': 'Fauxclaw'
    },
    body: JSON.stringify(payload),
    timeout: parseInt(process.env.FXC_TIMEOUT || '30000')
  });

  return { response, requestId: `or_${Date.now()}`, format: 'openai_sse', model: routerModel };
}
