// Simple circuit breaker to avoid hammering dead providers, like i said, complex shit is annoying as hell
// Not as fancy as Netflix Hystrix, but it works, unlike some things.

import { logger } from './utils/logger.js';

export class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 5;
    this.timeout = options.timeout || 60000;   // 1 minute open window
    this.failures = 0;
    this.state = 'CLOSED';   // CLOSED, OPEN, HALF_OPEN
    this.nextAttempt = 0;
  }

  async call(fn, ...args) {
    if (this.state === 'OPEN') {
      if (Date.now() >= this.nextAttempt) {
        this.state = 'HALF_OPEN';
        logger.info(` ${this.name} → HALF_OPEN (testing)`);
      } else {
        throw new Error(`Circuit breaker "${this.name}" is OPEN (${this.name} likely down)`);
      }
    }

    try {
      const result = await fn(...args);
      this._recordSuccess();
      return result;
    } catch (err) {
      this._recordFailure();
      throw err;
    }
  }

  _recordSuccess() {
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.failures = 0;
      logger.info(` ${this.name} → CLOSED (recovered)`);
    }
    this.failures = Math.max(0, this.failures - 1);
  }

  _recordFailure() {
    this.failures++;
    if (this.failures >= this.failureThreshold && this.state !== 'OPEN') {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
      logger.warn(` ${this.name} → OPEN (failing fast for ${this.timeout}ms)`);
    }
  }

  getState() {
    return { name: this.name, state: this.state, failures: this.failures };
  }
}
