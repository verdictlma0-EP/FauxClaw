// Groq provider – OpenAI-compatible Chat Completions
import { nodeHttps } from '../utils/http.js';
import { extractText } from '../utils/helpers.js';

// Map user-friendly model names to Groq model IDs
const MODEL_MAP = {
  'claude-sonnet-4-5': 'llama3-70b-8192',              // use Llama 3 70B
  'llama-3.3-70b-versatile': 'llama3-70b-8192',
  'mixtral-8x7b': 'mixtral-8x7b-32768',
  'gemma2-9b': 'gemma2-9b-it'
};

export async function groqChat(apiKey, body, model) {
  const cleanModel = model.replace(/^groq\//, '');
  const groqModel = MODEL_MAP[cleanModel] || cleanModel;

  const messages = body.messages?.map(m => ({
    role: m.role,
    content: extractText(m.content)
  })) || [];

  if (body.system && messages.length && messages[0].role !== 'system') {
    messages.unshift({ role: 'system', content: body.system });
  }

  const payload = {
    model: groqModel,
    messages,
    stream: body.stream !== false,
    max_tokens: Math.min(body.max_tokens || 4096, 4096),
    temperature: body.temperature ?? 0.7
  };

  const response = await nodeHttps('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload),
    timeout: parseInt(process.env.FXC_TIMEOUT || '30000')
  });

  return { response, requestId: `groq_${Date.now()}`, format: 'openai_sse', model: groqModel };
}
