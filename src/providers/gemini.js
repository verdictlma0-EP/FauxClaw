// Google Gemini provider 
import { nodeHttps } from '../utils/http.js';
import { extractText } from '../utils/helpers.js';

export async function geminiChat(apiKey, body, model) {
  const cleanModel = model.replace(/^gemini\//, '').replace('models/', '');
  
  const messages = body.messages?.map(m => ({
    role: m.role === 'assistant' ? 'model' : m.role,
    content: extractText(m.content)
  })) || [];
  
  if (body.system && messages.length && messages[0].role !== 'system') {
    messages.unshift({ role: 'system', content: body.system });
  }

  const payload = {
    model: cleanModel,
    messages,
    stream: body.stream !== false,
    max_tokens: Math.min(body.max_tokens || 4096, 4096),
    temperature: body.temperature ?? 0.7
  };

  const response = await nodeHttps(`https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload),
    timeout: parseInt(process.env.FXC_TIMEOUT || '30000')
  });

  return { response, requestId: `gemini_${Date.now()}`, format: 'sse' };
}
