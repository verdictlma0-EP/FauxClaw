# TODO

## High Priority (Next Release)

- [x] **Publish to npm** – disable 2FA temporarily, run `npm publish`, then re-enable.  
- [x] **Add one-line installer** – `curl -fsSL https://raw.githubusercontent.com/fauxclaw/fauxclaw/main/install.sh | sh` (and PowerShell equivalent).  
- [x] **Add demo GIF/screenshot** to README showing `fxc setup` → `fxc start` → Claude Code working.  
- [x] **Add GitHub badges** (npm version, license, Node version, build status).  

## Medium Priority

- [ ] **Improve error messages** – when provider fails, tell user exactly what went wrong (e.g., “Kiro token expired, auto-refresh failed”).  
- [x] **Add support for local providers** – Ollama, LM Studio, or llama.cpp (many users want offline free models).  
- [ ] **Add `fxc logs` command** – tail the last N lines of the proxy log.  
- [ ] **Windows installer** – wrap `fxc.exe` in a simple MSI or Inno Setup installer.  
- [ ] **GitHub Actions** – auto-build executables on release and run basic smoke tests.  
- [ ] **Obtain funding for premium API access** – e.g., Fable 5.0, GPT-4, or other paid models. Explore GitHub Sponsors, OpenCollective, or crypto donations to buy API credits for the community.  

## Low Priority / Nice to Have

- [ ] **Discord bot integration** – let users run Fauxclaw via Discord (inspired by free‑claude‑code).  
- [x] **Web admin UI** – simple local web page to edit config and see metrics (maybe just a static HTML page that calls the existing API).  
- [ ] **Model picker support** – ensure `/v1/models` returns accurate free model lists for each provider.  
- [x] **Add provider: Groq free tier** – they have a generous free tier for some models.  
- [x] **Add provider: Google Gemini free tier** – via OpenAI‑compatible endpoint.  
- [ ] **Unit tests** – start with `streaming.js` and `kiro.js` frame parser.  
- [ ] **TypeScript conversion** (optional) – many users expect TS, but low priority (keep simple).  

## Always

- [x] **Keep zero dependencies** – no new npm packages unless absolutely necessary.  
- [x] **Maintain Node.js 18+ compatibility** – do not use newer features without fallbacks.  
- [x] **Respond to issues within 48 hours** – responsiveness grows stars.  
