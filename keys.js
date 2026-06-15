// Pseudo — Keys & Settings Page Logic
// Checkbox model picker · Auto-open toggle · All providers from PROVIDER_KEY_NAME

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

  // Keys that map to the storage name
  const KEY_STORAGE_NAME = {
    google:     'google',
    openai:     'openai',
    anthropic:  'anthropic',
    'x-ai':     'xai',
    deepseek:   'deepseek',
    moonshotai: 'moonshotai',
  };

  // The storage key used in activeModels for each provider select value
  const ACTIVE_MODEL_KEY = {
    google:     'google',
    openai:     'openai',
    anthropic:  'anthropic',
    'x-ai':     'xai',
    deepseek:   'deepseek',
    moonshotai: 'moonshotai',
  };

  // Reverse map: activeModels storage key → OpenRouter prefix (for getModels calls)
  const STORAGE_TO_PREFIX = {
    google:     'google',
    openai:     'openai',
    anthropic:  'anthropic',
    xai:        'x-ai',
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
  const autoOpenToggle   = document.getElementById('auto-open-toggle');

  // Gemini model picker elements
  const geminiModelBtn      = document.getElementById('gemini-model-btn');
  const geminiModelLabel    = document.getElementById('gemini-model-label');
  const geminiModelDropdown = document.getElementById('gemini-model-dropdown');

  // =============================================
  // HELPERS
  // =============================================

  const FALLBACK_MODELS = [
    { id: 'google/gemini-3.5-flash',          name: 'Gemini 3.5 Flash' },
    { id: 'google/gemini-3.1-pro-preview',    name: 'Gemini 3.1 Pro' },
    { id: 'google/gemini-2.5-flash',          name: 'Gemini 2.5 Flash' },
    { id: 'anthropic/claude-opus-4-8',        name: 'Claude Opus 4.8' },
    { id: 'anthropic/claude-sonnet-4-6',      name: 'Claude Sonnet 4.6' },
    { id: 'anthropic/claude-haiku-4-5',       name: 'Claude Haiku 4.5' },
    { id: 'openai/gpt-5.5',                   name: 'GPT-5.5' },
    { id: 'openai/gpt-5.4-mini',              name: 'GPT-5.4 Mini' },
    { id: 'openai/gpt-4.1-mini',              name: 'GPT-4.1 Mini' },
    { id: 'deepseek/deepseek-v4-pro',         name: 'DeepSeek V4 Pro' },
    { id: 'deepseek/deepseek-v4-flash',       name: 'DeepSeek V4 Flash' },
    { id: 'x-ai/grok-4.3',                   name: 'Grok 4.3' },
    { id: 'x-ai/grok-build-0.1',             name: 'Grok Build 0.1' },
    { id: 'moonshotai/kimi-k2.6',            name: 'Kimi K2.6' },
  ];

  function getModels(providerPrefix) {
    return FALLBACK_MODELS.filter(m => m.id.startsWith(providerPrefix + '/'));
  }

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

  // §2 — Update the dynamic link based on selected provider
  function updateDynamicLink(keys) {
    const provider = providerSelect.value;
    const storageName = KEY_STORAGE_NAME[provider] || provider;
    const hasKey = !!keys[storageName];
    const info = API_KEY_LINKS[provider];

    if (info && !hasKey) {
      dynamicKeyLink.textContent = info.label;
      dynamicKeyLink.href = info.url;
      dynamicKeyLink.style.display = '';
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
  // CHECKBOX PICKER
  // Build a dropdown of checkboxes for a provider's models.
  // activeModels[storageKey] is now a SET (array) of enabled model IDs.
  // =============================================

  async function getActiveModels() {
    const { activeModels = {} } = await chrome.storage.local.get('activeModels');
    return activeModels;
  }

  async function setActiveModels(storageKey, modelIds) {
    const { activeModels = {} } = await chrome.storage.local.get('activeModels');
    activeModels[storageKey] = modelIds;
    await chrome.storage.local.set({ activeModels });
  }

  function updatePickerLabel(labelEl, checkedCount) {
    labelEl.textContent = checkedCount === 0
      ? 'none'
      : checkedCount === 1
        ? '1 model'
        : `${checkedCount} models`;
  }

  function buildModelPickerDropdown(dropdownEl, labelEl, providerPrefix, storageKey, activeModelList) {
    dropdownEl.innerHTML = '';
    const models = getModels(providerPrefix);
    const checked = new Set(Array.isArray(activeModelList) ? activeModelList : []);

    // Default: all models enabled if nothing stored yet
    const initialChecked = checked.size === 0 ? new Set(models.map(m => m.id)) : checked;

    models.forEach(m => {
      const item = document.createElement('label');
      item.className = 'model-picker-item';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = initialChecked.has(m.id);

      const nameSpan = document.createElement('span');
      nameSpan.className = 'model-picker-name';
      nameSpan.textContent = m.name;

      item.appendChild(cb);
      item.appendChild(nameSpan);
      dropdownEl.appendChild(item);

      cb.addEventListener('change', async () => {
        // Collect all checked boxes in this dropdown
        const allBoxes = dropdownEl.querySelectorAll('input[type="checkbox"]');
        const enabled = [];
        allBoxes.forEach((box, idx) => {
          if (box.checked) enabled.push(models[idx].id);
        });
        await setActiveModels(storageKey, enabled);
        updatePickerLabel(labelEl, enabled.length);
      });
    });

    // Set initial label
    const initEnabled = models.filter(m => initialChecked.has(m.id));
    updatePickerLabel(labelEl, initEnabled.length);

    // If this was the first time (nothing stored), persist the default
    if (checked.size === 0 && models.length > 0) {
      setActiveModels(storageKey, models.map(m => m.id));
    }
  }

  // Open/close a picker wrap
  function setupPickerToggle(btnEl, wrapEl) {
    btnEl.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = wrapEl.classList.contains('open');
      // Close all other pickers
      document.querySelectorAll('.model-picker-wrap.open').forEach(w => w.classList.remove('open'));
      if (!isOpen) wrapEl.classList.add('open');
    });
  }

  // =============================================
  // RENDER
  // =============================================

  async function renderKeys() {
    const { keys = {}, activeModels = {} } = await chrome.storage.local.get(['keys', 'activeModels']);

    // ---- Gemini section ----
    if (keys.google) {
      geminiOnboarding.style.display = 'none';
      geminiSaved.style.display = '';
      geminiMaskedKey.textContent = maskKey(keys.google);

      const geminiWrap = document.getElementById('gemini-model-btn').closest('.model-picker-wrap');
      buildModelPickerDropdown(
        geminiModelDropdown,
        geminiModelLabel,
        'google',
        'google',
        activeModels['google']
      );
      setupPickerToggle(geminiModelBtn, geminiWrap);
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
      const storageName  = KEY_STORAGE_NAME[p] || p;
      const activeKey    = ACTIVE_MODEL_KEY[p] || storageName;
      const modelPrefix  = STORAGE_TO_PREFIX[activeKey] || p;
      if (!keys[storageName]) continue;

      const row = document.createElement('div');
      row.className = 'key-row';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'key-provider';
      nameSpan.textContent = PROVIDERS[p]?.name || p;

      const maskedSpan = document.createElement('span');
      maskedSpan.className = 'key-masked';
      maskedSpan.textContent = maskKey(keys[storageName]);

      // Model picker wrap
      const pickerWrap = document.createElement('div');
      pickerWrap.className = 'model-picker-wrap';

      const pickerBtn = document.createElement('button');
      pickerBtn.className = 'model-picker-btn';
      pickerBtn.type = 'button';

      const pickerLabel = document.createElement('span');
      pickerLabel.className = 'model-picker-label';

      const chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      chevron.setAttribute('width', '10');
      chevron.setAttribute('height', '10');
      chevron.setAttribute('viewBox', '0 0 24 24');
      chevron.setAttribute('fill', 'none');
      chevron.setAttribute('stroke', 'currentColor');
      chevron.setAttribute('stroke-width', '2.5');
      chevron.setAttribute('stroke-linecap', 'round');
      chevron.setAttribute('stroke-linejoin', 'round');
      const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      poly.setAttribute('points', '6 9 12 15 18 9');
      chevron.appendChild(poly);

      pickerBtn.appendChild(pickerLabel);
      pickerBtn.appendChild(chevron);

      const pickerDropdown = document.createElement('div');
      pickerDropdown.className = 'model-picker-dropdown';

      pickerWrap.appendChild(pickerBtn);
      pickerWrap.appendChild(pickerDropdown);

      buildModelPickerDropdown(pickerDropdown, pickerLabel, modelPrefix, activeKey, activeModels[activeKey]);
      setupPickerToggle(pickerBtn, pickerWrap);

      const delBtn = document.createElement('button');
      delBtn.className = 'delete-btn';
      delBtn.title = 'Delete';
      delBtn.textContent = '×';
      delBtn.addEventListener('click', () => deleteKey(p));

      row.appendChild(nameSpan);
      row.appendChild(maskedSpan);
      row.appendChild(pickerWrap);
      row.appendChild(delBtn);
      keysList.appendChild(row);
    }

    // Disable options whose key is already saved
    Array.from(providerSelect.options).forEach(opt => {
      if (!opt.value) return;
      const sName = KEY_STORAGE_NAME[opt.value] || opt.value;
      opt.disabled = !!keys[sName];
    });

    providerSelect.value = '';
    updateDynamicLink(keys);
    newKeyInput.placeholder = 'Paste API key...';
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
  // AUTO-OPEN TOGGLE
  // =============================================

  async function loadAutoOpenSetting() {
    const { autoOpenLeetCode } = await chrome.storage.local.get('autoOpenLeetCode');
    // Default is ON (matches content.js behaviour: undefined !== false)
    const enabled = autoOpenLeetCode !== false;
    autoOpenToggle.setAttribute('aria-checked', String(enabled));
  }

  autoOpenToggle.addEventListener('click', async () => {
    const current = autoOpenToggle.getAttribute('aria-checked') === 'true';
    const next = !current;
    autoOpenToggle.setAttribute('aria-checked', String(next));
    await chrome.storage.local.set({ autoOpenLeetCode: next });
  });

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
    if (!provider) return;
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
    newKeyInput.placeholder = PROVIDERS[providerSelect.value]?.placeholder || 'Paste API key...';
  });

  // Enter-to-save
  geminiKeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') geminiSaveBtn.click();
  });

  newKeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addKeyBtn.click();
  });

  // Close pickers on outside click
  document.addEventListener('click', () => {
    document.querySelectorAll('.model-picker-wrap.open').forEach(w => w.classList.remove('open'));
  });

  // =============================================
  // INIT
  // =============================================

  renderKeys();
  loadAutoOpenSetting();

})();
