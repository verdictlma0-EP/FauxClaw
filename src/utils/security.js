// API key validation & rate limiting.
// Very simple = very good

const API_KEY = process.env.FXC_API_KEY;
const RATE_LIMIT = parseInt(process.env.FXC_RATE_LIMIT || '100');
const WINDOW_MS = 60000;

const rateStore = new Map();

export function validateApiKey(req) {
  if (!API_KEY) return true;
  const provided = req.headers['x-proxy-key'] || req.headers['authorization']?.replace(/^Bearer /i, '');
  return provided === API_KEY;
}

export function rateLimit(clientId) {
  if (!RATE_LIMIT) return true;
  const now = Date.now();
  let record = rateStore.get(clientId);
  if (!record || now > record.resetTime) {
    record = { count: 0, resetTime: now + WINDOW_MS };
  }
  record.count++;
  rateStore.set(clientId, record);
  return record.count <= RATE_LIMIT;
}

// Optional: cleanup rate store every minute to avoid memory leaks ;O
setInterval(() => {
  const now = Date.now();
  for (const [id, rec] of rateStore.entries()) {
    if (now > rec.resetTime) rateStore.delete(id);
  }
}, 60000);
