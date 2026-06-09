// Pseudo — Keys & Settings Page Logic
// §2 Dynamic 'Get API key' links · All providers from PROVIDER_KEY_NAME

(() => {
  'use strict';

  // Maps provider select value → display name
  const PROVIDERS = {
    google:      { name: 'Google / Gemini', placeholder: 'AIza...' },
    openai:      { name: 'OpenAI',          placeholder: 'sk-...' },
    anthropic:   { name: 'Anthropic',       placeholder: 'sk-ant-...' },
    'x-ai':      { name: 'xAI / Grok',      placeholder: 'xai-...' },
    deepseek:    { name: 'DeepSeek',        placeholder: 'sk-...' },
    moonshotai:  { name: 'Moonshot / Kimi', placeholder: 'sk-...' },
  };

  // §2 — Dynamic link map: provider value → { label, url }
  const API_KEY_LINKS = {
    google:     { label: 'Get a Gemini API key →',  url: 'https://aistudio.google.com/app/apikey' },
    anthropic:  { label: 'Get an Anthropic key →',  url: 'https://console.anthropic.com/keys' },
    openai:     { label: 'Get an OpenAI key →',     url: 'https://platform.openai.com/api-keys' },
    'x-ai':     { label: 'Get a Grok (xAI) key →', url: 'https://console.x.ai/' },
    deepseek:   { label: 'Get a DeepSeek key →',   url: 'https://platform.deepseek.com/api_keys' },
    moonshotai: { label: 'Get a Kimi key →',        url: 'https://platform.moonshot.ai/' },
  };

  // Keys that map to the 'google' provider option in this page
  // (panel.js uses 'google' as the keyName for google/* models)
  const KEY_STORAGE_NAME = {
    google:     'google',
    openai:     'openai',
    anthropic:  'anthropic',
    'x-ai':     'xai',
    deepseek:   'deepseek',
    moonshotai: 'moonshotai',
  };

  // =============================================
  // DOM
  // =============================================

  const geminiOnboarding = document.getElementById('gemini-onboarding');
  const geminiSaved      = document.getElementById('gemini-saved');
  const geminiMaskedKey  = document.getElementById('gemini-masked-key');
  const geminiDeleteBtn  = document.getElementById('gemini-delete-btn');
  const geminiKeyInput   = document.getElementById('gemini-key-input');
  const geminiSaveBtn    = document.getElementById('gemini-save-btn');
  const geminiFeedback   = document.getElementById('gemini-feedback');
  const keysList         = document.getElementById('keys-list');
  const providerSelect   = document.getElementById('provider-select');
  const newKeyInput      = document.getElementById('new-key-input');
  const addKeyBtn        = document.getElementById('add-key-btn');
  const keyFeedback      = document.getElementById('key-feedback');
  const dynamicKeyLink   = document.getElementById('dynamic-key-link');

  // =============================================
  // HELPERS
  // =============================================

  function maskKey(key) {
    if (!key || key.length <= 8) return '••••••••';
    return key.substring(0, 4) + '••••••' + key.substring(key.length - 4);
  }

  function showFeedback(el, type, msg) {
    el.textContent = msg;
    el.className = 'feedback visible ' + type;
    setTimeout(() => {
      el.className = 'feedback';
      el.textContent = '';
    }, 3000);
  }

  // §2 — Update the dynamic link based on selected provider and whether it has a key
  function updateDynamicLink(keys) {
    const provider = providerSelect.value;
    const storageName = KEY_STORAGE_NAME[provider] || provider;
    const hasKey = !!keys[storageName];
    const info = API_KEY_LINKS[provider];

    if (info && !hasKey) {
      dynamicKeyLink.textContent = info.label;
      dynamicKeyLink.href = info.url;
      dynamicKeyLink.style.display = '';
      // Soft fade
      dynamicKeyLink.style.opacity = '0';
      requestAnimationFrame(() => {
        dynamicKeyLink.style.transition = 'opacity 200ms ease';
        dynamicKeyLink.style.opacity = '1';
      });
    } else {
      dynamicKeyLink.style.display = 'none';
    }
  }

  // =============================================
  // RENDER
  // =============================================

  async function renderKeys() {
    const { keys = {} } = await chrome.storage.local.get('keys');

    // ---- Gemini section ----
    if (keys.google) {
      geminiOnboarding.style.display = 'none';
      geminiSaved.style.display = '';
      geminiMaskedKey.textContent = maskKey(keys.google);
    } else {
      geminiOnboarding.style.display = '';
      geminiSaved.style.display = 'none';
      geminiKeyInput.value = '';
      geminiKeyInput.placeholder = 'AIza...';
    }

    // ---- Other provider key rows ----
    keysList.innerHTML = '';
    const providers = ['openai', 'anthropic', 'x-ai', 'deepseek', 'moonshotai'];

    for (const p of providers) {
      const storageName = KEY_STORAGE_NAME[p] || p;
      if (!keys[storageName]) continue;

      const row = document.createElement('div');
      row.className = 'key-row';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'key-provider';
      nameSpan.textContent = PROVIDERS[p]?.name || p;

      const maskedSpan = document.createElement('span');
      maskedSpan.className = 'key-masked';
      maskedSpan.textContent = maskKey(keys[storageName]);

      const delBtn = document.createElement('button');
      delBtn.className = 'delete-btn';
      delBtn.title = 'Delete';
      delBtn.textContent = '×';
      delBtn.addEventListener('click', () => deleteKey(p));

      row.appendChild(nameSpan);
      row.appendChild(maskedSpan);
      row.appendChild(delBtn);
      keysList.appendChild(row);
    }

    // Disable options whose key is already saved
    Array.from(providerSelect.options).forEach(opt => {
      const sName = KEY_STORAGE_NAME[opt.value] || opt.value;
      opt.disabled = !!keys[sName];
    });

    // Select first non-disabled
    const firstAvailable = Array.from(providerSelect.options).find(o => !o.disabled);
    if (firstAvailable) providerSelect.value = firstAvailable.value;

    updateDynamicLink(keys);
  }

  // =============================================
  // SAVE / DELETE
  // =============================================

  async function saveKey(providerSelectValue, keyValue) {
    if (!keyValue || !keyValue.trim()) return;
    const storageName = KEY_STORAGE_NAME[providerSelectValue] || providerSelectValue;
    const { keys = {} } = await chrome.storage.local.get('keys');
    keys[storageName] = keyValue.trim();
    await chrome.storage.local.set({ keys });
    await renderKeys();
  }

  async function deleteKey(providerSelectValue) {
    const storageName = KEY_STORAGE_NAME[providerSelectValue] || providerSelectValue;
    const { keys = {} } = await chrome.storage.local.get('keys');
    delete keys[storageName];
    await chrome.storage.local.set({ keys });
    await renderKeys();
  }

  // =============================================
  // EVENT LISTENERS
  // =============================================

  // Save Gemini key (stored under 'google')
  geminiSaveBtn.addEventListener('click', async () => {
    const key = geminiKeyInput.value.trim();
    if (!key) return;
    await saveKey('google', key);
    geminiKeyInput.value = '';
    showFeedback(geminiFeedback, 'success', 'Gemini key saved');
  });

  geminiDeleteBtn.addEventListener('click', async () => {
    await deleteKey('google');
  });

  // Add other provider key
  addKeyBtn.addEventListener('click', async () => {
    const provider = providerSelect.value;
    const key = newKeyInput.value.trim();
    if (!key) return;
    await saveKey(provider, key);
    newKeyInput.value = '';
    showFeedback(keyFeedback, 'success', `${PROVIDERS[provider]?.name || provider} key saved`);
  });

  // §2 — Dynamic link updates on dropdown change
  providerSelect.addEventListener('change', async () => {
    const { keys = {} } = await chrome.storage.local.get('keys');
    updateDynamicLink(keys);
    // Update placeholder
    newKeyInput.placeholder = PROVIDERS[providerSelect.value]?.placeholder || 'Paste API key...';
  });

  // Enter-to-save
  geminiKeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') geminiSaveBtn.click();
  });

  newKeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addKeyBtn.click();
  });

  // =============================================
  // INIT
  // =============================================

  renderKeys();

})();
