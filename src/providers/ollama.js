import { nodeHttps } from '../utils/http.js';
import { extractText } from '../utils/helpers.js';
import { formatSSE } from '../utils/streaming.js';

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

  // If non-streaming, we convert later; for streaming we use a generator
  return { response, requestId: `ollama_${Date.now()}`, format: 'ollama', model: cleanModel };
}

export async function* streamOllamaResponse(response, requestId, model) {
  let buffer = '';
  let hasStarted = false;
  let hasContentStarted = false;
  let outputTokens = 0;
  let inputTokens = 0;
  let fullContent = '';
  let finalFinishReason = 'end_turn';

  for await (const chunk of response) {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const data = JSON.parse(line);
        if (data.message?.content) {
          const content = data.message.content;
          if (!hasStarted) {
            hasStarted = true;
            yield formatSSE('message_start', {
              type: 'message_start',
              message: {
                id: requestId || `msg_${Date.now()}`,
                type: 'message',
                role: 'assistant',
                content: [],
                model: model || 'ollama',
                stop_reason: null,
                stop_sequence: null,
                usage: { input_tokens: 0, output_tokens: 0 }
              }
            });
          }
          if (!hasContentStarted) {
            hasContentStarted = true;
            yield formatSSE('content_block_start', {
              type: 'content_block_start',
              index: 0,
              content_block: { type: 'text', text: '' }
            });
          }
          fullContent += content;
          outputTokens += Math.ceil(content.length / 4);
          yield formatSSE('content_block_delta', {
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'text_delta', text: content }
          });
        }
        if (data.done) {
          finalFinishReason = 'end_turn';
          inputTokens = data.prompt_eval_count || 0;
          outputTokens = data.eval_count || 0;
        }
      } catch {}
    }
  }

  if (hasContentStarted) {
    yield formatSSE('content_block_stop', { type: 'content_block_stop', index: 0 });
  }
  yield formatSSE('message_delta', {
    type: 'message_delta',
    delta: { stop_reason: finalFinishReason, stop_sequence: null },
    usage: { output_tokens: outputTokens }
  });
  yield formatSSE('message_stop', { type: 'message_stop' });

  if (!hasStarted) {
    // No content
    yield formatSSE('message_start', {
      type: 'message_start',
      message: {
        id: requestId || `msg_${Date.now()}`,
        type: 'message',
        role: 'assistant',
        content: [],
        model: model || 'ollama',
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 0, output_tokens: 0 }
      }
    });
    yield formatSSE('content_block_start', {
      type: 'content_block_start',
      index: 0,
      content_block: { type: 'text', text: '' }
    });
    yield formatSSE('content_block_stop', { type: 'content_block_stop', index: 0 });
    yield formatSSE('message_delta', {
      type: 'message_delta',
      delta: { stop_reason: 'end_turn', stop_sequence: null },
      usage: { output_tokens: 0 }
    });
    yield formatSSE('message_stop', { type: 'message_stop' });
  }
}

export function convertOllamaToAnthropicJSON(ollamaBody, model) {
  const content = ollamaBody.message?.content || '';
  return {
    id: `msg_${Date.now()}`,
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text: content }],
    model: model || 'ollama',
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: {
      input_tokens: ollamaBody.prompt_eval_count || 0,
      output_tokens: ollamaBody.eval_count || 0
    }
  };
}
