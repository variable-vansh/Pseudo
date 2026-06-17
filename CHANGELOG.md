# Changelog

All notable changes to Pseudo are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).  
Versions follow [Semantic Versioning](https://semver.org/).

---

## [1.0.0] — 2026-06-17

### Added
- Initial open source release
- Side-panel pseudocode → code generation using your own API key
- **Six providers:** Google Gemini, Anthropic Claude, OpenAI GPT, DeepSeek, xAI Grok, Moonshot Kimi
- **Ten languages:** C++, Python, Java, JavaScript, TypeScript, Go, Rust, C, Kotlin, Swift
- Live model list fetched from OpenRouter with 24-hour cache and curated allowlist fallback
- Exact token usage display (input / thinking / output / total) from native provider APIs
- Per-session efficiency score — starts at 100, penalises extra iterations and token-heavy prompts
- Optional token budget with visual progress bar
- Session history — last 50 sessions with scores, iteration counts, and pseudocode snippets
- Wide (800 px) / narrow (400 px) panel toggle
- Draggable floating tab when panel is minimised
- Auto-open on LeetCode problem pages (configurable)
- Read-only system prompt viewer in footer
- Local-only storage — no backend, no analytics, no tracking

### Architecture
- Panel logic refactored from a single 1 583-line IIFE into **16 focused ES modules** under `panel/`
- `<script type="module">` entry point — no bundler required
- Clean dependency graph with no circular imports
