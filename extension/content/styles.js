/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Styles for the Foxshot overlay, panel, preview dialog and copied hint.
 * Ported from Firefox:
 *   browser/components/screenshots/overlay/overlay.css
 *   browser/components/screenshots/screenshots-buttons.css
 *   browser/components/screenshots/screenshots-preview.css
 * with the Firefox design-system tokens they depend on inlined.
 * Kept as a JS string so it can be applied with adoptedStyleSheets, which
 * page Content-Security-Policies can't block.
 */

globalThis.__foxshotCSS = String.raw`
:host {
  color-scheme: light dark;

  /* --- Firefox design tokens (tokens-shared / tokens-brand) --- */
  --color-white: #ffffff;
  --color-gray-0: #fbfbfe;
  --color-gray-50: #bfbfc9;
  --color-gray-60: #8f8f9d;
  --color-gray-70: #5b5b66;
  --color-gray-90: #1c1b22;
  --color-gray-100: #15141a;
  --color-blue-60: oklch(55% 0.24 260);
  --color-blue-70: oklch(48% 0.2 260);
  --color-blue-80: oklch(41% 0.17 260);
  --color-cyan-10: oklch(90% 0.07 205);
  --color-cyan-20: oklch(83% 0.11 205);
  --color-cyan-30: oklch(76% 0.14 205);
  --color-black-alpha-50: oklch(0 0 0 / 50%);
  --color-white-alpha-20: oklch(1 0 0 / 20%);

  --space-xxsmall: 2px;
  --space-xsmall: 4px;
  --space-small: 8px;
  --space-medium: 12px;
  --space-large: 16px;
  --space-xlarge: 24px;

  --border-width: 1px;
  --border-radius-small: 4px;
  --border-radius-medium: 8px;
  --border-radius-circle: 9999px;
  --border-color: light-dark(var(--color-gray-50), var(--color-gray-70));

  --box-shadow-color-lighter-layer-1: light-dark(rgba(0, 0, 0, 0.03), rgba(0, 0, 0, 0.15));
  --box-shadow-color-lighter-layer-2: light-dark(rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.2));
  --popup-box-shadow: 0 0.375px 1.5px var(--box-shadow-color-lighter-layer-1), 0 3px 12px var(--box-shadow-color-lighter-layer-2);
  --popup-border-color: light-dark(rgb(240, 240, 244), rgb(82, 82, 94));
  --popup-border-radius: var(--border-radius-medium);

  --background-color-overlay: var(--color-black-alpha-50);
  --background-color-canvas: light-dark(var(--color-white), var(--color-gray-90));
  --text-color: light-dark(var(--color-gray-100), var(--color-gray-0));

  --color-accent-primary: light-dark(var(--color-blue-60), var(--color-cyan-30));
  --color-accent-primary-hover: light-dark(var(--color-blue-70), var(--color-cyan-20));
  --color-accent-primary-active: light-dark(var(--color-blue-80), var(--color-cyan-10));

  --focus-outline-width: 2px;
  --focus-outline-offset: 2px;
  --focus-outline-color: var(--color-accent-primary);

  --button-min-height: 32px;
  --button-padding: var(--space-xsmall) var(--space-large);
  --button-border-radius: var(--border-radius-medium);
  --button-font-weight: 600;
  --button-border-color: transparent;
  --button-background-color: color-mix(in srgb, currentColor 7%, transparent);
  --button-background-color-hover: color-mix(in srgb, currentColor 14%, transparent);
  --button-background-color-active: color-mix(in srgb, currentColor 21%, transparent);
  --button-text-color: light-dark(var(--color-gray-100), var(--color-gray-0));
  --button-background-color-primary: var(--color-accent-primary);
  --button-background-color-primary-hover: var(--color-accent-primary-hover);
  --button-background-color-primary-active: var(--color-accent-primary-active);
  --button-text-color-primary: light-dark(var(--color-white), var(--color-gray-100));

  /* Browser-chrome panel colours (tokens-platform, browser theme layer) */
  --panel-background-color: light-dark(var(--color-white), rgb(66, 65, 77));
  --panel-text-color: light-dark(#000000, rgb(251, 251, 254));

  --hover-highlight-background-color: var(--color-white-alpha-20);

  --screenshots-lowest-layer: 1;
  --screenshots-low-layer: 2;
  --screenshots-high-layer: 3;
  --screenshots-highest-layer: 4;

}

/* The host element is reset with "all: initial" (so page styles can't leak
   in), which also resets inherited properties; set them on each top-level
   piece of UI instead. */
:host > * {
  color-scheme: light dark;
  font-family: system-ui, "Segoe UI", Cantarell, Ubuntu, "Helvetica Neue", Arial, sans-serif;
  font-size: 15px;
  line-height: normal;
  color: var(--text-color);
  text-align: start;
  direction: ltr;
}

* {
  box-sizing: content-box;
}

[hidden] {
  display: none !important;
}

svg.icon {
  width: 16px;
  height: 16px;
  fill: currentColor;
  flex-shrink: 0;
  pointer-events: none;
}

/* ---------- in-content button (toolkit/themes/shared/in-content/common-shared.css) ---------- */

button {
  appearance: none;
  font: inherit;
  font-size: 1em;
  font-weight: var(--button-font-weight);
  line-height: normal;
  min-height: var(--button-min-height);
  color: var(--button-text-color);
  border: var(--border-width) solid var(--button-border-color);
  border-radius: var(--button-border-radius);
  background-color: var(--button-background-color);
  padding: var(--button-padding);
  text-decoration: none;
  margin: var(--space-xsmall) var(--space-xsmall);
  box-sizing: border-box;
  letter-spacing: normal;
  text-transform: none;
}

button:focus-visible {
  box-shadow: none;
  outline: var(--focus-outline-width) solid var(--focus-outline-color);
  outline-offset: var(--focus-outline-offset);
}

button:enabled:hover {
  background-color: var(--button-background-color-hover);
}

button:enabled:hover:active {
  background-color: var(--button-background-color-active);
}

button:disabled {
  opacity: 0.5;
}

button.primary {
  background-color: var(--button-background-color-primary);
  color: var(--button-text-color-primary);
}

button.primary:enabled:hover {
  background-color: var(--button-background-color-primary-hover);
}

button.primary:enabled:hover:active {
  background-color: var(--button-background-color-primary-active);
}

button.ghost-button {
  background-color: transparent;
}

/* ---------- overlay (browser/components/screenshots/overlay/overlay.css) ---------- */

#screenshots-component {
  position: absolute;
  top: 0;
  left: 0;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
  pointer-events: auto;
  cursor: crosshair;
}

#screenshots-component[dragging] {
  cursor: grabbing;
}

#screenshots-component[resizing] {
  position: fixed;
  inset: 0;
  width: 100% !important;
  height: 100% !important;
}

#selection-container {
  overflow: clip;
  position: absolute;
  inset: 0;
  pointer-events: none;
}

#preview-container {
  overflow: clip;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: sticky;
  top: 0;
  inset-inline: 0;
  width: 100vw;
  height: 100vh;
  background-color: var(--background-color-overlay);
}

#buttons-container {
  position: absolute;
  margin: 10px 0;
  cursor: auto;
  z-index: var(--screenshots-highest-layer);
}

#selection-size,
#buttons-container {
  padding: 4px;
  background-color: var(--background-color-canvas);
  color: var(--text-color);
  border-radius: var(--border-radius-small);
}

#selection-size {
  border: var(--border-width) solid var(--border-color);
  box-shadow: var(--popup-box-shadow);
  white-space: nowrap;
}

.buttons-wrapper,
#selection-size-container {
  display: flex;
  align-items: center;
  justify-content: center;
}

.screenshots-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-xsmall);
  cursor: pointer;
  text-align: center;
  user-select: none;
  white-space: nowrap;
  z-index: var(--screenshots-highest-layer);
  min-width: 32px;
  margin-inline: 4px;
}

#selection-size-container {
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: var(--screenshots-lowest-layer);
}

#screenshots-cancel-button {
  margin-top: 20px;
  border-color: #fff;
  color: #fff;
}

#screenshots-cancel-button:hover {
  background-color: white;
  color: #000;
}

.screenshots-button > label {
  pointer-events: none;
  cursor: inherit;
}

#face-container {
  position: relative;
  width: 64px;
  height: 64px;
}

#face-container:focus-visible {
  outline: var(--focus-outline-width) solid var(--focus-outline-color);
  outline-offset: var(--focus-outline-offset);
}

#face-container .face-line-color {
  fill: #fff;
}

#face-container .face-pupil-color {
  fill: #000;
}

.preview-instructions {
  color: #fff;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: pulse 125ms cubic-bezier(0.07, 0.95, 0, 1);
  font-size: 24px;
  line-height: 32px;
  padding: 20px;
  width: 400px;
}

#hover-highlight {
  animation: fade-in 125ms forwards cubic-bezier(0.07, 0.95, 0, 1);
  background: var(--hover-highlight-background-color);
  border: 2px dashed rgba(255, 255, 255, 0.4);
  border-radius: 1px;
  box-sizing: border-box;
  pointer-events: none;
  position: absolute;
  z-index: var(--screenshots-high-layer);
}

#top-background {
  top: 0;
  left: 0;
  width: 100%;
}

#left-background {
  left: 0;
}

#bottom-background {
  left: 0;
  width: 100%;
}

.bghighlight {
  background-color: var(--background-color-overlay);
  position: absolute;
  overflow: clip;
  pointer-events: none;
  z-index: -1;
}

.highlight {
  border: 2px dashed rgba(255, 255, 255, 0.8);
  box-sizing: border-box;
  cursor: move;
  position: absolute;
  pointer-events: auto;
  z-index: var(--screenshots-lowest-layer);
  outline-offset: 8px;
}

.highlight:focus-visible,
.mover-target:focus-visible {
  outline: var(--focus-outline-width) solid var(--focus-outline-color);
}

.mover-target {
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  z-index: var(--screenshots-high-layer);
  pointer-events: auto;
  outline-offset: -15px;
}

.mover-target.direction-topLeft {
  cursor: nwse-resize;
  height: 60px;
  left: -30px;
  top: -30px;
  width: 60px;
}

.mover-target.direction-top {
  cursor: ns-resize;
  height: 60px;
  inset-inline-start: 0;
  top: -30px;
  width: 100%;
  z-index: var(--screenshots-low-layer);
}

.mover-target.direction-topRight {
  cursor: nesw-resize;
  height: 60px;
  right: -30px;
  top: -30px;
  width: 60px;
}

.mover-target.direction-left {
  cursor: ew-resize;
  height: 100%;
  left: -30px;
  top: 0;
  width: 60px;
  z-index: var(--screenshots-low-layer);
}

.mover-target.direction-right {
  cursor: ew-resize;
  height: 100%;
  right: -30px;
  top: 0;
  width: 60px;
  z-index: var(--screenshots-low-layer);
}

.mover-target.direction-bottomLeft {
  bottom: -30px;
  cursor: nesw-resize;
  height: 60px;
  left: -30px;
  width: 60px;
}

.mover-target.direction-bottom {
  bottom: -30px;
  cursor: ns-resize;
  height: 60px;
  inset-inline-start: 0;
  width: 100%;
  z-index: var(--screenshots-low-layer);
}

.mover-target.direction-bottomRight {
  bottom: -30px;
  cursor: nwse-resize;
  height: 60px;
  right: -30px;
  width: 60px;
}

.mover-target:hover .mover {
  transform: scale(1.05);
}

.mover {
  background-color: white;
  border-radius: var(--border-radius-circle);
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.5);
  transition: transform 125ms cubic-bezier(0.07, 0.95, 0, 1);
  position: relative;
  height: 16px;
  width: 16px;
  pointer-events: none;
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.06); }
  100% { transform: scale(1); }
}

/* ---------- "Save visible / Save full page" panel (screenshots-buttons.css) ---------- */

#screenshots-panel {
  --screenshots-icon-background-color: var(--color-gray-60);
  --button-background-color: light-dark(rgba(207, 207, 216, 0.33), rgba(0, 0, 0, 0.33));
  --button-background-color-hover: light-dark(rgba(207, 207, 216, 0.66), rgba(207, 207, 216, 0.2));
  --button-background-color-active: light-dark(rgb(207, 207, 216), rgba(207, 207, 216, 0.4));
  --button-text-color: light-dark(rgb(21, 20, 26), rgb(251, 251, 254));
  --button-text-color-primary: light-dark(rgb(251, 251, 254), rgb(43, 42, 51));

  position: fixed;
  /* Firefox tucks the panel's top edge under the toolbar */
  top: -8px;
  inset-inline-end: 10px;
  z-index: 5;
  padding: 12px;
  background-color: var(--panel-background-color);
  color: var(--panel-text-color);
  border-radius: var(--popup-border-radius);
  pointer-events: auto;
  cursor: default;
}

#screenshots-panel .button-group {
  display: flex;
  justify-content: flex-end;
}

#screenshots-panel .button-group > button {
  margin: 0;
}

#screenshots-panel .button-group > button + button {
  margin-inline-start: var(--space-small);
}

#full-page,
#visible-page {
  position: relative;
  min-width: 90px;
  padding: 46px 5px 5px;
  margin: 2px !important;
  color: var(--button-text-color);
}

#full-page.primary {
  color: var(--button-text-color-primary);
}

.panel-icon {
  position: absolute;
  top: 0;
  left: 50%;
  translate: -50% 0;
  width: 46px;
  height: 46px;
  pointer-events: none;
}

.panel-icon .ctx-fill {
  fill: currentColor;
}

.panel-icon .ctx-stroke {
  fill: var(--screenshots-icon-background-color);
}

/* ---------- preview dialog (tab-dialog box + screenshots-preview.css) ---------- */

#preview-dialog {
  position: fixed;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  background-color: var(--background-color-overlay);
  pointer-events: auto;
  cursor: default;
  z-index: 6;
}

.dialog-box {
  display: flex;
  width: 100%;
  height: 100%;
  margin: -5px 0 0;
  max-width: clamp(80%, 100% + (600px - 100%) / 2, 100%);
  max-height: clamp(90%, 100% + (600px - 100%) / 2, 100%);
  overflow: hidden;
  background-color: var(--background-color-canvas);
  color: var(--text-color);
  outline: 0.5px solid var(--popup-border-color);
  border-radius: var(--popup-border-radius);
  box-shadow: var(--popup-box-shadow);
}

.image-view {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}

.preview-buttons {
  display: flex;
  gap: var(--space-small);
  align-items: center;
  justify-content: flex-end;
  width: 98%;
  padding: var(--space-small) 0;
}

/* moz-button */
.preview-buttons > button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-small);
  margin: 0;
  cursor: default;
}

.preview-buttons > button.icon-button {
  width: var(--button-min-height);
  height: var(--button-min-height);
  padding: 0;
}

#preview-image-container {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0 2% 2%;
}

#preview-image {
  display: block;
  width: 100%;
}

/* ---------- "Screenshot copied!" confirmation hint ---------- */

#confirmation-hint {
  position: fixed;
  top: 6px;
  inset-inline-end: 12px;
  display: flex;
  align-items: center;
  gap: var(--space-small);
  padding: var(--space-small) var(--space-medium);
  background-color: var(--button-background-color-primary);
  color: var(--button-text-color-primary);
  border-radius: var(--popup-border-radius);
  box-shadow: var(--popup-box-shadow);
  font-weight: normal;
  pointer-events: none;
  animation: hint-in 150ms ease-out;
  transition: opacity 200ms ease;
}

#confirmation-hint.closing {
  opacity: 0;
}

#confirmation-hint-checkmark-animation-container {
  position: relative;
  overflow: hidden;
  width: 16px;
  height: 16px;
}

#confirmation-hint-checkmark-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 304px;
  height: 16px;
  animation: confirmation-hint-checkmark-animation 300ms steps(18) 60ms forwards;
}

#confirmation-hint-checkmark-image path {
  stroke: currentColor;
}

@media (prefers-reduced-motion: reduce) {
  #confirmation-hint-checkmark-image {
    animation-duration: 0s;
    animation-delay: 0s;
  }
}

@keyframes confirmation-hint-checkmark-animation {
  from { transform: translateX(0); }
  to { transform: translateX(-288px); }
}

@keyframes hint-in {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: none; }
}
`;
