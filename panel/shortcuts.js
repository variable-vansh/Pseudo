// panel/shortcuts.js — Platform detection and keyboard shortcut helpers.

'use strict';

export function isMacPlatform() {
  const platform = navigator.userAgentData?.platform || navigator.platform || '';
  return /mac|iphone|ipad|ipod/i.test(platform);
}

export function shortcutMod() {
  return isMacPlatform() ? '⌘' : 'Ctrl';
}

export function isShortcut(e, key, shiftKey = false) {
  const wantsMod = isMacPlatform()
    ? e.metaKey && !e.ctrlKey
    : e.ctrlKey && !e.metaKey;
  return wantsMod && e.shiftKey === shiftKey && e.key.toLowerCase() === key.toLowerCase();
}

export function updateShortcutLabel(shortcutLabelEl) {
  const mod = shortcutMod();
  if (shortcutLabelEl) shortcutLabelEl.textContent = `${mod}+Return`;
}
