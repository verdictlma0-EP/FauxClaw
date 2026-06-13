import { nodeHttps } from '../utils/http.js';
import { extractText } from '../utils/helpers.js';

export async function ollamaChat(baseUrl, body, model) {
  const cleanModel = model.replace(/^ollama\//, '');
  
  const messages = body.messages?.map(m => ({
    role: m.role,
    content: extractText(m.content)
  })) || [];

  const payload = {
    model: cleanModel,
    messages,
    stream: body.stream !== false,
    options: {
      num_predict: body.max_tokens || 4096,
      temperature: body.temperature ?? 0.7
    }
  };

  const response = await nodeHttps(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    timeout: parseInt(process.env.FXC_TIMEOUT || '30000')
  });

  return { response, requestId: `ollama_${Date.now()}`, format: 'ollama' };
}

export async function* streamOllamaResponse(response) {
  let buffer = '';
  for await (const chunk of response) {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const data = JSON.parse(line);
        if (data.message?.content) {
          yield `event: content_block_delta\ndata: ${JSON.stringify({
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'text_delta', text: data.message.content }
          })}\n\n`;
        }
      } catch (e) {}
    }
  }
}
