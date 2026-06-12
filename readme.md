# FAUXCLAW

> *Real Claude. Fake Bill.*  
> A free AI proxy for Claude Code that scratches your AI itch without scratching your wallet.

Fauxclaw routes Claude Code requests through multiple **free** providers – AWS CodeWhisperer (Kiro), OpenRouter free tier, and iFlow – with automatic failover, token refresh, and zero configuration beyond the initial setup.

**No credit card. No AWS bill. Just Claude.**

---

## Quick start

```bash
# Clone the repo
git clone https://github.com/fauxclaw/fauxclaw
cd fauxclaw

# Make the CLI available globally (optional)
npm link

# Setup providers (Kiro OAuth, API keys)
fxc setup

# Start the proxy
fxc start
Then point Claude Code (or any Anthropic‑compatible client) to:

export ANTHROPIC_BASE_URL=http://localhost:8083
export ANTHROPIC_API_KEY=anything   # or your FXC_API_KEY if you set one
claude
What you get
Provider	Models	Cost	Auto refresh
Kiro (AWS CodeWhisperer)	Claude Sonnet 4.5, Haiku	Free (AWS Builder ID)	✅
OpenRouter	Claude 3.5 Haiku, GPT‑4o mini, DeepSeek	Free tier	❌ (static key)
iFlow	DeepSeek R1, Qwen, Llama	Free (token)	❌
Fallback chain: Kiro → OpenRouter → iFlow
If one provider fails or rate‑limits you, Fauxclaw automatically tries the next.

Commands
fxc setup          # Interactive provider setup (Kiro device auth, API keys)
fxc start          # Launch the proxy (default)
fxc status         # Show token expiry & provider health
fxc metrics        # Request latency, success rates, provider breakdown
fxc purge          # Delete expired conversation sessions
fxc help           # You're looking at it
🔧 Configuration
Environment variables (optional – most things are in ~/.fauxclaw/config.json after setup):

FXC_PORT=8083                     # Port to listen on
FXC_HOST=127.0.0.1                # Bind address (use 0.0.0.0 for external)
FXC_API_KEY=your-secret           # Require this in X-Proxy-Key header
FXC_RATE_LIMIT=100                # Requests per minute per IP
FXC_LOG=info                      # debug | info | warn | error
All tokens and OAuth secrets are stored in ~/.fauxclaw/config.json with 0600 permissions.

🧠 How it works
Claude Code sends a request to http://localhost:8083/v1/messages

Fauxclaw tries providers in order:

Kiro – uses AWS Builder ID OAuth device flow. Tokens refresh automatically.

OpenRouter – forwards to :free models.

iFlow – adds HMAC signature and session headers.

If streaming, binary AWS EventStream (Kiro) is translated to Anthropic SSE.

If a provider fails, circuit breaker opens for 60s to avoid hammering.

❓ FAQ
Is this legal?
Yes. You're using AWS CodeWhisperer's free tier as intended (via your own AWS Builder ID). Fauxclaw just acts as a translation layer.

Do I need an AWS account?
Yes, a free one. You'll authenticate via https://view.awsapps.com/start once during fxc setup.

Can I use this in production?
Please don't. It's a weekend project. But if you do, at least enable FXC_API_KEY and keep it behind a firewall.

Why "Fauxclaw"?
Because it's a fake (faux) Claw (Claude/Claw Code) – and lobsters have claws. Also, "Fauxclaw" sounds like "faux claw", which is what you use when you don't have real claws. I'm not good at naming things but here we are.

Contributing
See BUILDME.md for development setup, testing, and how to add a new provider.

License
MIT – do whatever you want, but don't blame me if AWS changes their API tomorrow or smth dumb happens ig.

Credits
Reverse‑engineered from:

free-claude-code

9router

claudecodeui

And a lot of staring at binary EventStream dumps.

"Fake it till you make it, but today you made it." 🦞
