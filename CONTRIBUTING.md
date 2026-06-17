# Contributing to Pseudo

Thanks for your interest in contributing. Pseudo is a vanilla-JS Chrome MV3 extension — no build step, no bundler. You can be running and editing it in under two minutes.

---

## Running locally

1. Clone the repo
   ```bash
   git clone https://github.com/variable-vansh/Pseudo.git
   cd Pseudo
   ```
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** → select the `Pseudo/` directory
5. Open any supported coding platform (e.g. a LeetCode problem) and click the Pseudo toolbar icon

**After editing any file:** go to `chrome://extensions` and click the refresh icon on the Pseudo card. If you edited `panel/` files, also close and reopen the panel.

---

## Project structure

The panel logic is split into focused ES modules in `panel/`. Here's the dependency order from leaf to root:

```
constants.js   No deps — all static config
state.js       No deps — mutable state + setters
dom.js         No deps — el{} DOM reference map
pricing.js     ← constants
models.js      ← constants, pricing
metrics.js     ← dom, state
shortcuts.js   No deps
panel-mode.js  ← dom, state
api.js         ← constants, models, state
storage.js     ← constants, dom, state, models
session.js     ← dom, state, models, storage
history.js     ← dom, state
dropdowns.js   ← constants, dom, state, models, metrics, storage
generate.js    ← constants, dom, state, models, api, pricing, metrics, storage, session, dropdowns
events.js      ← (all of the above)
index.js       ← everything — entry point
```

**Rule:** no circular imports. If you need a function from module A inside module B and B is already upstream of A, pass it as a parameter instead.

---

## Adding a new provider

1. **`panel/constants.js`**
   - Add the native API endpoint to `PROVIDER_ENDPOINTS`
   - Add the key storage name to `PROVIDER_KEY_NAME`
   - Add to `ALLOWED_PREFIXES`
   - Add the display label to `PROVIDER_LABELS`

2. **`panel/api.js`**
   - If the provider uses an OpenAI-compatible API, `callOpenAICompat()` will handle it automatically via `PROVIDER_ENDPOINTS`.
   - If it uses a custom request/response format, add a `callProviderName()` function modelled on `callGoogle()` or `callAnthropic()`, then add a branch in `dispatchAPI()`.

3. **`panel/pricing.js`**
   - Add an entry to `MODEL_PRICING` for each model (per-1M-token rates).

4. **`keys.html` / `keys.js`**
   - Add the provider to the `<select>` in `keys.html`.
   - Add the provider to the `PROVIDERS` map and helper links in `keys.js`.

5. **Test**: Add your API key in Settings and verify generation works end-to-end.

---

## Updating the model allowlist

The allowlist lives in `panel/constants.js` (`SUPPORTED_MODELS` set and `FALLBACK_MODELS` array) and in `keys.js` (the per-provider model checkboxes).

Update both files together. The `SUPPORTED_MODELS` set is the single gate — models not in it are silently dropped even if returned by OpenRouter.

---

## Code conventions

- **Vanilla JS only.** No frameworks, no build step.
- **ES modules** in `panel/`. Plain scripts everywhere else (content.js, background.js, keys.js).
- **Strict mode** (`'use strict'`) in all files.
- **State mutations** go through the setter functions in `state.js` — don't reassign exported primitives directly from another module.
- **No inline styles** added from JS except where the original code already does so (session banner bar colours, floating tab positioning).
- **No new permissions** without a very strong reason — keep the manifest minimal.

---

## Pull requests

- Keep PRs focused — one feature or fix per PR.
- If adding a provider or model, update both `constants.js` and `keys.js` in the same PR.
- No minification or bundling — the source should be readable as-is.
- Run a quick end-to-end test (generate code with at least one provider) before opening the PR.

---

## Issues

Use GitHub Issues for bugs, feature requests, and questions. Please include:
- Browser and OS version
- Which provider/model you were using
- What you expected vs. what happened
- The error message if any (check the browser console in the panel: right-click the panel → Inspect)
