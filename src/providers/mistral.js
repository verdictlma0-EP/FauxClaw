// Mistral provider – OpenAI-compatible Chat Completions
import { nodeHttps } from '../utils/http.js';
import { extractText } from '../utils/helpers.js';

export async function mistralChat(apiKey, body, model) {
  const cleanModel = model.replace(/^mistral\//, '');
  
  const messages = body.messages?.map(m => ({
    role: m.role,
    content: extractText(m.content)
  })) || [];
  
  if (body.system && messages.length && messages[0].role !== 'system') {
    messages.unshift({ role: 'system', content: body.system });
  }

  const payload = {
    model: cleanModel,
    messages: messages,
    stream: body.stream !== false,
    max_tokens: Math.min(body.max_tokens || 4096, 4096),
    temperature: body.temperature ?? 0.7
  };

  const response = await nodeHttps('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload),
    timeout: parseInt(process.env.FXC_TIMEOUT || '30000')
  });

  // Mistral returns OpenAI-format SSE, needs conversion
  return { response, requestId: `mistral_${Date.now()}`, format: 'openai_sse' };
}
