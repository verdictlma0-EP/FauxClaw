// Streaming helpers for Kiro's binary EventStream.
// This file is imported by kiro.js but split out for clarity.

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
      if (type === 7) { // string header
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
