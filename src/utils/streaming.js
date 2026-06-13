// AWS EventStream frame parser for Kiro binary responses

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

// Convert OpenAI-format SSE to Anthropic SSE
export function convertOpenAIToAnthropicSSE(openaiChunk) {
  try {
    const data = JSON.parse(openaiChunk);
    
    if (data.choices && data.choices[0] && data.choices[0].delta) {
      const delta = data.choices[0].delta;
      const content = delta.content || '';
      
      if (content) {
        return {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: content }
        };
      }
    }
    
    return null;
  } catch (e) {
    return null;
  }
}
