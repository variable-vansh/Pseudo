// panel/panel-mode.js — Wide/narrow panel resize logic.

'use strict';

import { el } from './dom.js';
import { setPanelMode } from './state.js';

export const NARROW_W = 400;
export const WIDE_W   = 800;

export function applyPanelMode(mode, animate = true) {
  setPanelMode(mode);
  const w = mode === 'wide' ? WIDE_W : NARROW_W;
  window.parent.postMessage({ type: 'pseudo-set-width', width: w, animate }, '*');

  // Swap icon: when narrow show expand arrows; when wide show compress arrows
  if (mode === 'wide') {
    el.wideIcon.innerHTML =
      '<polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/>' +
      '<line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/>';
  } else {
    el.wideIcon.innerHTML =
      '<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>' +
      '<line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>';
  }
}
