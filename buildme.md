# Building & Developing Fauxclaw

So you want to hack on Fauxclaw? Awesome. Here's what you need to know.

---

## Prerequisites

- **Node.js 18+** (no dependencies, uses only built‑in modules)
- **npm** (for linking, maybe testing later)
- **AWS Builder ID** (free) – for Kiro testing
- **Optional**: OpenRouter API key, iFlow token

---

## Project structure
fauxclaw/
├── bin/
│ └── fxc.js # CLI entry point
├── src/
│ ├── config.js # ~/.fauxclaw/config.json mgmt
│ ├── server.js # HTTP server, request routing
│ ├── session.js # In‑memory session store
│ ├── circuitbreaker.js # Per‑provider circuit breaker
│ ├── status.js # Status reporting
│ ├── providers/
│ │ ├── index.js # Provider registry & fallback
│ │ ├── kiro.js # AWS CodeWhisperer (binary stream)
│ │ ├── openrouter.js # OpenRouter API
│ │ └── iflow.js # iFlow (HMAC + session)
│ └── utils/
│ ├── logger.js # Coloured, level‑based
│ ├── metrics.js # Request counters & latency
│ ├── security.js # API key + rate limiting
│ ├── http.js # node https wrapper
│ ├── helpers.js # extractText, detectLanguage
│ ├── streaming.js # AWS EventStream frame parser
│ └── branding.js # ASCII lobster, status formatting
└── scripts/
└── setup.js # Interactive OAuth / key wizard


## Development workflow

# Clone and enter
git clone https://github.com/fauxclaw/fauxclaw
cd fauxclaw

# Make fxc available locally (no global install)
npm link

# Run in dev mode with debug logs
FXC_LOG=debug fxc start

# Or run directly without linking
node bin/fxc.js start
Testing (manual for now)
There are no unit tests yet (This is why we love MPL)
To test a change:

1. Kiro provider test
bash
fxc setup  # complete device auth
fxc start
# In another terminal:
curl -N -X POST http://localhost:8083/v1/messages \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5",
    "messages": [{"role": "user", "content": "Say hello"}],
    "stream": true
  }'
2. OpenRouter test
bash
# Add your key during setup or manually in ~/.fauxclaw/config.json
# Then same curl as above
3. SSE streaming test
bash
curl -N -X POST http://localhost:8083/v1/messages \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5",
    "messages": [{"role": "user", "content": "Count to 3"}],
    "stream": true
  }'
# You should see event: content_block_delta lines
4. Non-streaming test
bash
curl -X POST http://localhost:8083/v1/messages \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5",
    "messages": [{"role": "user", "content": "Say hi"}],
    "stream": false
  }'
Adding a new provider
Create src/providers/mycoolprovider.js

Implement a function that returns:

js
{ response, requestId, format } // format = 'sse' or 'binary'
Add it to the fallback chain in providers/index.js

Add setup steps in scripts/setup.js

Update getAvailableProviders() in providers/index.js

Minimal provider template:
javascript
// src/providers/mycoolprovider.js
import { nodeHttps } from '../utils/http.js';

export async function mycoolproviderChat(apiKey, body, model) {
  const response = await nodeHttps('https://api.example.com/v1/chat', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ...body,
      model: model,
      stream: body.stream !== false
    }),
    timeout: parseInt(process.env.FXC_TIMEOUT || '30000')
  });

  return {
    response,
    requestId: `mycool_${Date.now()}`,
    format: 'sse'  // or 'binary' if they use custom streaming
  };
}
Adding to fallback chain:
javascript
// src/providers/index.js, add to the switch statement ig
else if (provider === 'mycoolprovider') {
  const key = config.mycoolprovider?.apiKey;
  if (!key) throw new Error('MyCoolProvider API key missing');
  result = await cb.call(() => mycoolproviderChat(key, body, model));
}
Adding to setup wizard:
javascript
// scripts/setup.js – add after iFlow section
console.log('━━━ MyCoolProvider ━━━');
const myKey = await ask('MyCoolProvider API key (or Enter to skip): ');
if (myKey.trim()) {
  config.mycoolprovider = { apiKey: myKey.trim() };
  saveConfig(config);
  console.log('✅ MyCoolProvider configured.\n');
}
Debugging tips
Enable debug logging
bash
FXC_LOG=debug fxc start
You'll see every request, provider attempt, and frame parse.

Kiro binary frame debugging
Add this inside streamKiroResponse in kiro.js:

javascript
console.log('Frame:', eventType, frame.payload?.slice(0, 100));
Rate limiting issues
bash
# Disable rate limiting entirely
FXC_RATE_LIMIT=0 fxc start
Circuit breaker state
bash
fxc status  # Shows if any provider is OPEN
Config file inspection
bash
cat ~/.fauxclaw/config.json | jq '.'  # if you have jq
# or just
cat ~/.fauxclaw/config.json
Check if server is running
bash
curl http://localhost:8083/health
# Should return: {"status":"fauxclaw is scratching",...}
Packaging for distribution
bash
# Create a tarball
npm pack

# Test install from tarball
npm install -g fauxclaw-2.0.0.tgz

# Or publish to npm (if you have an account)
npm publish
Note: The project has zero npm dependencies – it's pure Node.js. npm install does nothing except create an empty node_modules folder. That's intentional.

Contributing guidelines
Please Do:
Keep it dependency‑free – no axios, express, chalk, commander, etc.

Use built‑in Node.js modules only (http, https, crypto, fs, path, os, readline)

Write plain .js – no TypeScript, no build step

Add error handling that fails gracefully

Update README.md and BUILDME.md for user‑facing changes

Test manually before submitting

Keep MPL-2.0 license headers on new files

Don't:
Add dependencies to package.json

Use external APIs without adding them to the provider chain

Break the existing fallback logic

Remove the circuit breaker pattern

Change the ~/.fauxclaw/config.json structure without a migration path

Remove or alter license headers

Pull request checklist:
Code runs with FXC_LOG=debug no crashes

Existing providers still work (Kiro, OpenRouter, iFlow)

New provider (if any) has setup wizard integration

Docs updated

No new dependencies

MPL-2.0 license header present in new files

Cleaning up
Remove all traces
bash
# Config and tokens
rm -rf ~/.fauxclaw

# If globally installed
npm uninstall -g fauxclaw

# Remove local link
npm unlink
Clear expired sessions only
bash
fxc purge
Kill stuck processes
bash
lsof -ti:8083 | xargs kill -9  # if FXC_PORT is 8083
Architecture decisions (why things are this way)
Decision	Reason
No dependencies	Zero supply chain risk, works offline, easy audit
No TypeScript	Faster iteration, less ceremony
In‑memory sessions	Simple, no Redis required. Enough for personal use
Circuit breaker	Stops hammering dead providers, keeps latency low
Plain HTTP server	Express would add 30 deps. Node's http is fine
Config in ~/.fauxclaw/	Standard Unix pattern, respects user privacy
0600 permissions	Tokens are sensitive. No world‑readable
MPL-2.0 license	File-level copyleft, patent protection, still permissive enough for commercial use
Security notes for contributors
Never log tokens – use [REDACTED] if you absolutely need to print config

Validate API keys – don't assume they're well‑formed

Rate limiting – prevents abuse if exposed to internet

CORS – locked down to what Claude Code needs, not wide open

No eval – obviously. Don't get clever with dynamic imports from user input

Learning resources
If you're new to some of these concepts:

AWS EventStream format – what Kiro uses for streaming

Anthropic Messages API – what Claude Code expects

OAuth Device Flow – how Kiro auth works

Server‑Sent Events (SSE) – streaming format Claude Code understands

Mozilla Public License 2.0 – why we chose this license

📄License
Mozilla Public License 2.0 (MPL-2.0)

This SourceCode Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.

All source files must include the MPL-2.0 header:

javascript
/**
 * FAUXCLAW – Real Claude. Fake Bill.
 * 
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 * 
 * SPDX-License-Identifier: MPL-2.0
 */
Getting help
Issues: GitHub issues – be specific, include FXC_LOG=debug output

Discussions: GitHub Discussions for feature requests

Quick question: Tag with question label

Contact 
Verdict.lma0@gmail.com
or not_verdict_lmao on discord
discord uid is 1462148414148968682
