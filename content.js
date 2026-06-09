// Pseudo — Content Script
// §4 Wide/narrow panel resize  §7 Draggable collapsed icon

(() => {
  'use strict';

  if (window.__pseudoInjected) return;
  window.__pseudoInjected = true;

  const NARROW_W = 400;
  const WIDE_W   = 800;

  let panelIframe  = null;
  let panelVisible = false;
  let floatingTab  = null;
  let currentWidth = NARROW_W;

  // =============================================
  // PLATFORM DETECTION
  // =============================================

  const PLATFORMS = {
    leetcode: {
      pattern:         /leetcode\.com\/problems\//,
      titleSelector:   '[data-cy="question-title"], .text-title-large, h1 a',
      verdictSelector: '[data-e2e-locator="submission-result"]',
      verdictText:     'accepted',
    },
    codeforces: {
      pattern:         /codeforces\.com\/(problemset\/problem|contest\/\d+\/problem)\//,
      titleSelector:   '.problem-statement .header .title',
      verdictSelector: '.verdict-accepted, .verdict_accepted, td.verdict-accepted',
      verdictText:     'accepted',
    },
    hackerrank: {
      pattern:         /hackerrank\.com\/challenges\//,
      titleSelector:   '.challenge-page-label, .ui-icon-label h1, h1.challenge-name',
      verdictSelector: '.congrats-heading, .congratulations-wrapper, .success-message',
      verdictText:     'congratulations',
    },
    atcoder: {
      pattern:         /atcoder\.jp\/contests\/[^/]+\/tasks\//,
      titleSelector:   'h2 .h2, #task-statement h2',
      verdictSelector: '#judge-status',
      verdictText:     'ac',
    },
    codechef: {
      pattern:         /codechef\.com\/problems\//,
      titleSelector:   '.breadcrumbs h1, ._problem__title_',
      verdictSelector: '._success_message_, .success-msg',
      verdictText:     'correct',
    },
  };

  function detectPlatform() {
    const url = window.location.href;
    for (const [name, cfg] of Object.entries(PLATFORMS)) {
      if (cfg.pattern.test(url)) return { name, cfg };
    }
    return null;
  }

  function getProblemTitle(platform) {
    if (!platform) return document.title;
    try {
      const el = document.querySelector(platform.cfg.titleSelector);
      if (el) return el.textContent.trim() || document.title;
    } catch (_) {}
    return document.title.split(' - ')[0].split(' | ')[0].trim();
  }

  // =============================================
  // PANEL INJECTION
  // =============================================

  function createPanel() {
    if (panelIframe) return;

    panelIframe = document.createElement('iframe');
    panelIframe.id  = 'pseudo-panel-iframe';
    panelIframe.src = chrome.runtime.getURL('panel.html');

    Object.assign(panelIframe.style, {
      position:   'fixed',
      top:        '0',
      right:      '0',
      width:      currentWidth + 'px',
      height:     '100vh',
      border:     'none',
      zIndex:     '2147483647',
      background: '#111111',
      borderLeft: '1px solid rgba(255, 255, 255, 0.06)',
      transition: 'transform 250ms cubic-bezier(0.16, 1, 0.3, 1), width 200ms ease',
      transform:  'translateX(100%)',
    });

    document.body.appendChild(panelIframe);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        panelIframe.style.transform = 'translateX(0)';
      });
    });

    panelVisible = true;

    panelIframe.addEventListener('load', () => {
      const platform = detectPlatform();
      if (platform) {
        panelIframe.contentWindow.postMessage({
          type:     'pseudo-platform-info',
          platform: platform.name,
          url:      window.location.href,
          title:    getProblemTitle(platform),
        }, '*');
        startVerdictWatcher(platform);
      }
    });

    if (floatingTab) {
      floatingTab.remove();
      floatingTab = null;
    }
  }

  function removePanel() {
    if (!panelIframe) return;
    panelIframe.style.transform = 'translateX(100%)';
    const iframe = panelIframe;
    panelIframe = null;
    panelVisible = false;
    setTimeout(() => iframe.remove(), 250);
    showFloatingTab();
  }

  function togglePanel() {
    if (panelVisible && panelIframe) removePanel();
    else createPanel();
  }

  // §4 — Resize panel width from panel's postMessage
  function setPanelWidth(width, animate) {
    currentWidth = width;
    if (!panelIframe) return;
    if (!animate) {
      const prev = panelIframe.style.transition;
      panelIframe.style.transition = 'transform 250ms cubic-bezier(0.16, 1, 0.3, 1)';
      panelIframe.style.width = width + 'px';
      requestAnimationFrame(() => {
        panelIframe.style.transition = prev;
      });
    } else {
      panelIframe.style.width = width + 'px';
    }
  }

  // =============================================
  // §7 — DRAGGABLE FLOATING TAB
  // =============================================

  function showFloatingTab() {
    if (floatingTab) return;

    floatingTab = document.createElement('div');
    floatingTab.id = 'pseudo-floating-tab';

    const ICON_H = 36;
    const ICON_RIGHT = 16;

    // Restore saved Y or default to center
    chrome.storage.local.get('collapsedIconY', ({ collapsedIconY }) => {
      let initTop;
      if (collapsedIconY !== undefined) {
        initTop = Math.max(8, Math.min(window.innerHeight - ICON_H - 8, collapsedIconY));
      } else {
        initTop = window.innerHeight / 2 - ICON_H / 2;
      }

      Object.assign(floatingTab.style, {
        position:       'fixed',
        right:          ICON_RIGHT + 'px',
        top:            initTop + 'px',
        width:          ICON_H + 'px',
        height:         ICON_H + 'px',
        background:     '#1c1c1c',
        border:         '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius:   '8px',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        cursor:         'grab',
        zIndex:         '2147483646',
        transition:     'border-color 150ms ease',
        fontFamily:     "'Inter', -apple-system, sans-serif",
        userSelect:     'none',
      });

      floatingTab.innerHTML = '<span style="font-size:14px;font-weight:600;color:#2dd4bf;pointer-events:none;">P</span>';
      document.body.appendChild(floatingTab);
      attachDrag(floatingTab, ICON_H, ICON_RIGHT);
    });

    floatingTab.addEventListener('mouseenter', () => {
      if (!isDragging) floatingTab.style.borderColor = 'rgba(45, 212, 191, 0.35)';
    });
    floatingTab.addEventListener('mouseleave', () => {
      if (!isDragging) floatingTab.style.borderColor = 'rgba(255, 255, 255, 0.06)';
    });
  }

  let isDragging   = false;
  let dragStartY   = 0;
  let dragInitTop  = 0;

  function attachDrag(elem, iconH, iconRight) {
    elem.addEventListener('mousedown', (e) => {
      // Only left button
      if (e.button !== 0) return;
      isDragging   = true;
      dragStartY   = e.clientY;
      dragInitTop  = parseInt(elem.style.top, 10);
      elem.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const delta  = e.clientY - dragStartY;
      const newTop = Math.max(8, Math.min(window.innerHeight - iconH - 8, dragInitTop + delta));
      elem.style.top = newTop + 'px';
    });

    document.addEventListener('mouseup', (e) => {
      if (!isDragging) return;
      isDragging = false;
      elem.style.cursor = 'grab';
      document.body.style.userSelect = '';

      const finalTop = parseInt(elem.style.top, 10);
      const moved = Math.abs(e.clientY - dragStartY);

      // Save position
      chrome.storage.local.set({ collapsedIconY: finalTop });

      // If barely moved → treat as click → open panel
      if (moved < 6) createPanel();
    });
  }

  // =============================================
  // VERDICT WATCHER
  // =============================================

  let verdictObserver = null;

  function startVerdictWatcher(platform) {
    if (verdictObserver) verdictObserver.disconnect();

    verdictObserver = new MutationObserver(() => {
      try {
        const el = document.querySelector(platform.cfg.verdictSelector);
        if (el && el.textContent.toLowerCase().includes(platform.cfg.verdictText)) {
          if (panelIframe && panelIframe.contentWindow) {
            panelIframe.contentWindow.postMessage({ type: 'pseudo-verdict-accepted' }, '*');
          }
          verdictObserver.disconnect();
        }
      } catch (_) {}
    });

    verdictObserver.observe(document.body, {
      childList:     true,
      subtree:       true,
      characterData: true,
    });
  }

  // =============================================
  // MESSAGE LISTENERS
  // =============================================

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'toggle-panel') {
      togglePanel();
      sendResponse({ ok: true });
    }
    return true;
  });

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg || !msg.type) return;

    if (msg.type === 'pseudo-minimize') {
      removePanel();
    } else if (msg.type === 'pseudo-set-width') {
      setPanelWidth(msg.width, msg.animate !== false);
    }
  });

  // =============================================
  // AUTO-INJECT
  // =============================================

  // Restore saved panel width before creating
  chrome.storage.local.get('panelMode', ({ panelMode }) => {
    currentWidth = panelMode === 'wide' ? WIDE_W : NARROW_W;
    const platform = detectPlatform();
    if (platform) setTimeout(createPanel, 800);
  });

})();
