import re

with open('keys.js', 'r') as f:
    content = f.read()

models_list = '''
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

  function getModels(provider) {
    // x-ai provider prefix from OpenRouter maps to 'x-ai', but the IDs are like x-ai/grok... Wait, they are x-ai/
    return FALLBACK_MODELS.filter(m => m.id.startsWith(provider + '/'));
  }

  async function setActiveModel(provider, modelId) {
    const { activeModels = {} } = await chrome.storage.local.get('activeModels');
    activeModels[provider] = modelId;
    await chrome.storage.local.set({ activeModels });
  }
'''

dom_defs = '''
  const geminiModelSelect = document.getElementById('gemini-model-select');
'''

render_replacement = '''
  async function renderKeys() {
    const { keys = {}, activeModels = {} } = await chrome.storage.local.get(['keys', 'activeModels']);

    // ---- Gemini section ----
    if (keys.google) {
      geminiOnboarding.style.display = 'none';
      geminiSaved.style.display = '';
      geminiMaskedKey.textContent = maskKey(keys.google);
      
      geminiModelSelect.innerHTML = '';
      const gModels = getModels('google');
      if (!activeModels['google'] && gModels.length > 0) {
        activeModels['google'] = gModels[0].id; // Fallback
        chrome.storage.local.set({ activeModels });
      }
      gModels.forEach(m => {
        const o = document.createElement('option');
        o.value = m.id;
        o.textContent = m.name;
        if (m.id === activeModels['google']) o.selected = true;
        geminiModelSelect.appendChild(o);
      });
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

      const selectBtn = document.createElement('select');
      selectBtn.className = 'model-select provider-select';
      selectBtn.style.flex = '1';
      
      const pModels = getModels(p);
      if (!activeModels[storageName] && pModels.length > 0) {
        activeModels[storageName] = pModels[0].id;
        chrome.storage.local.set({ activeModels });
      }
      pModels.forEach(m => {
        const o = document.createElement('option');
        o.value = m.id;
        o.textContent = m.name;
        if (m.id === activeModels[storageName]) o.selected = true;
        selectBtn.appendChild(o);
      });
      selectBtn.addEventListener('change', async (e) => {
        await setActiveModel(storageName, e.target.value);
      });

      const delBtn = document.createElement('button');
      delBtn.className = 'delete-btn';
      delBtn.title = 'Delete';
      delBtn.textContent = '×';
      delBtn.addEventListener('click', () => deleteKey(p));

      row.appendChild(nameSpan);
      row.appendChild(maskedSpan);
      row.appendChild(selectBtn);
      row.appendChild(delBtn);
      keysList.appendChild(row);
    }

    // Disable options whose key is already saved
    Array.from(providerSelect.options).forEach(opt => {
      if (!opt.value) return; // Keep placeholder enabled or handle specially?
      const sName = KEY_STORAGE_NAME[opt.value] || opt.value;
      opt.disabled = !!keys[sName];
    });

    // Reset to placeholder
    providerSelect.value = "";

    updateDynamicLink(keys);
    // Update placeholder based on selected initially empty
    newKeyInput.placeholder = 'Paste API key...';
  }
'''

content = content.replace("const dynamicKeyLink   = document.getElementById('dynamic-key-link');", "const dynamicKeyLink   = document.getElementById('dynamic-key-link');\n" + dom_defs)
content = content.replace("// =============================================\n  // HELPERS\n  // =============================================", "// =============================================\n  // HELPERS\n  // =============================================\n" + models_list)

import re

# replace renderKeys entirely
content = re.sub(r'async function renderKeys\(\) \{.*?\n  \}\n', render_replacement[1:], content, flags=re.DOTALL)

with open('keys.js', 'w') as f:
    f.write(content)
