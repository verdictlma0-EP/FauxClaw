// NVIDIA NIM
import { nodeHttps } from '../utils/http.js';
import { extractText } from '../utils/helpers.js';

export async function nvidiaChat(apiKey, body, model) {
  // Remove 'nvidia_nim/' prefix if present
  const cleanModel = model.replace(/^nvidia_nim\//, '');
  
  // Convert Anthropic format to OpenAI format
  const messages = body.messages?.map(m => ({
    role: m.role,
    content: extractText(m.content)
  })) || [];
  
  // Add system message if present
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

  const response = await nodeHttps('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload),
    timeout: parseInt(process.env.FXC_TIMEOUT || '30000')
  });

  return { response, requestId: `nvidia_${Date.now()}`, format: 'sse' };
}
