// Simple in‑memory session store, complex memory stuff is annoying as hell
// Sessions expire after 1 hour by default because thats how long rammerhead does sessions i think.

import { logger } from './utils/logger.js';

const DEFAULT_TTL = 3600000;      // 1 hour 
const CLEANUP_INTERVAL = 60000;   // every minute

export class SessionStore {
  constructor(maxSize = 100, ttl = DEFAULT_TTL) {
    this.sessions = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
    this.interval = setInterval(() => this.cleanup(), CLEANUP_INTERVAL);
  }

  get(id) {
    const entry = this.sessions.get(id);
    if (!entry) return null;
    if (Date.now() - entry.lastAccessed > this.ttl) {
      this.sessions.delete(id);
      return null;
    }
    entry.lastAccessed = Date.now();
    return entry.data;
  }

  set(id, data) {
    if (this.sessions.size >= this.maxSize) {
      // evict oldest
      const oldest = [...this.sessions.entries()]
        .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed)[0];
      if (oldest) this.sessions.delete(oldest[0]);
    }
    this.sessions.set(id, {
      data,
      lastAccessed: Date.now(),
      created: Date.now()
    });
  }

  cleanup() {
    const now = Date.now();
    let removed = 0;
    for (const [id, entry] of this.sessions.entries()) {
      if (now - entry.lastAccessed > this.ttl) {
        this.sessions.delete(id);
        removed++;
      }
    }
    if (removed > 0) logger.debug(`Cleaned ${removed} expired sessions`);
  }

  purge() {
    const count = this.sessions.size;
    this.sessions.clear();
    return count;
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
  }
}

export const sessionStore = new SessionStore();
