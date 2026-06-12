// iFlow, Chinese free provider with HMAC auth
// Token from iflow.cn. Works unsurprisingly well, since it is made in china ;P

import crypto from 'crypto';
import { nodeHttps } from '../utils/http.js';
import { extractText } from '../utils/helpers.js';

export async function iflowChat(token, body, model) {
  const sessionId = `faux_${crypto.randomUUID()}`;
  const timestamp = Date.now();
  const userAgent = 'Fauxclaw/2.0';

  const hmac = crypto.createHmac('sha256', token);
  hmac.update(`${userAgent}:${sessionId}:${timestamp}`);
  const signature = hmac.digest('hex');

  const messages = body.messages?.map(m => ({
    role: m.role,
    content: extractText(m.content)
  })) || [];

  if (body.system && messages.length && messages[0].role !== 'system') {
    messages.unshift({ role: 'system', content: body.system });
  }

  const response = await nodeHttps('https://apis.iflow.cn/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'User-Agent': userAgent,
      'session-id': sessionId,
      'x-iflow-timestamp': timestamp.toString(),
      'x-iflow-signature': signature,
      'Accept': 'text/event-stream'
    },
    body: JSON.stringify({
      model: 'deepseek-r1',    // best free model they have
      messages,
      stream: body.stream !== false,
      max_tokens: Math.min(body.max_tokens || 4096, 8192),
      temperature: body.temperature ?? 0.7,
      top_p: 0.9
    }),
    timeout: parseInt(process.env.FXC_TIMEOUT || '30000')
  });

  return { response, requestId: `if_${Date.now()}`, format: 'sse' };
}
