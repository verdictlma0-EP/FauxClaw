// AWS EventStream frame parser for Kiro binary responses
import { logger } from './logger.js';

const MAX_FRAME_SIZE = parseInt(process.env.FXC_MAX_BUFFER || '5242880');

export function parseEventFrame(data) {
  try {
    const totalLen = data.readUInt32BE(0);
    if (totalLen < 16 || totalLen > MAX_FRAME_SIZE) return null;
    const headersLen = data.readUInt32BE(4);
    if (headersLen > totalLen - 16) return null;

    let off = 12;
    const headers = {};
    while (off < 12 + headersLen && off < totalLen - 4) {
      const nameLen = data[off++];
      if (off + nameLen > data.length) break;
      const name = data.subarray(off, off + nameLen).toString();
      off += nameLen;
      const type = data[off++];
      if (type === 7) {
        const valLen = data.readUInt16BE(off);
        off += 2;
        if (off + valLen > data.length) break;
        headers[name] = data.subarray(off, off + valLen).toString();
        off += valLen;
      } else break;
    }

    const payloadStart = 12 + headersLen;
    const payloadEnd = totalLen - 4;
    let payload = null;
    if (payloadEnd > payloadStart && payloadStart < data.length) {
      const raw = data.subarray(payloadStart, Math.min(payloadEnd, data.length)).toString();
      if (raw) {
        try { payload = JSON.parse(raw); } catch { payload = { raw }; }
      }
    }
    return { headers, payload };
  } catch {
    return null;
  }
}

export function formatSSE(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// Convert OpenAI-format SSE to Anthropic SSE (stateful generator)
export async function* streamOpenAIAsAnthropic(response, requestId, model) {
  let buffer = '';
  let hasStarted = false;
  let hasContentStarted = false;
  let outputTokens = 0;
  let inputTokens = 0;
  let finishReason = 'end_turn';
  let contentAccumulator = '';

  for await (const chunk of response) {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const jsonStr = line.slice(6).trim();
        if (!jsonStr || jsonStr === '[DONE]') continue;
        try {
          const data = JSON.parse(jsonStr);
          if (data.choices && data.choices[0]) {
            const choice = data.choices[0];
            const delta = choice.delta || {};
            const content = delta.content || '';
            if (content) {
              if (!hasStarted) {
                hasStarted = true;
                yield formatSSE('message_start', {
                  type: 'message_start',
                  message: {
                    id: requestId || `msg_${Date.now()}`,
                    type: 'message',
                    role: 'assistant',
                    content: [],
                    model: model || 'unknown',
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
              contentAccumulator += content;
              outputTokens += Math.ceil(content.length / 4);
              yield formatSSE('content_block_delta', {
                type: 'content_block_delta',
                index: 0,
                delta: { type: 'text_delta', text: content }
              });
            }
            if (data.usage) {
              inputTokens = data.usage.prompt_tokens || 0;
              outputTokens = data.usage.completion_tokens || outputTokens;
            }
            if (choice.finish_reason) {
              finishReason = choice.finish_reason === 'stop' ? 'end_turn' : choice.finish_reason;
            }
          }
        } catch (e) {
          // ignore parse errors
        }
      }
    }
  }

  // Flush
  if (hasContentStarted) {
    yield formatSSE('content_block_stop', { type: 'content_block_stop', index: 0 });
  }
  yield formatSSE('message_delta', {
    type: 'message_delta',
    delta: { stop_reason: finishReason, stop_sequence: null },
    usage: { output_tokens: outputTokens }
  });
  yield formatSSE('message_stop', { type: 'message_stop' });

  if (!hasStarted) {
    // No content received at all
    yield formatSSE('message_start', {
      type: 'message_start',
      message: {
        id: requestId || `msg_${Date.now()}`,
        type: 'message',
        role: 'assistant',
        content: [],
        model: model || 'unknown',
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

// Convert non-streaming OpenAI JSON to Anthropic JSON
export function convertOpenAIToAnthropicJSON(openaiBody, model) {
  const choice = openaiBody.choices && openaiBody.choices[0];
  if (!choice) {
    return {
      id: `msg_${Date.now()}`,
      type: 'message',
      role: 'assistant',
      content: [],
      model: model || 'unknown',
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0 }
    };
  }
  const content = choice.message?.content || '';
  return {
    id: openaiBody.id || `msg_${Date.now()}`,
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text: content }],
    model: model || openaiBody.model || 'unknown',
    stop_reason: choice.finish_reason === 'stop' ? 'end_turn' : (choice.finish_reason || 'end_turn'),
    stop_sequence: null,
    usage: {
      input_tokens: openaiBody.usage?.prompt_tokens || 0,
      output_tokens: openaiBody.usage?.completion_tokens || 0
    }
  };
}
