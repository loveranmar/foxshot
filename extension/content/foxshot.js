/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Foxshot: Firefox's screenshot tool, ported to a Chromium extension.
 *
 * Ported from Firefox (mozilla-firefox/firefox, MPL 2.0):
 *   browser/components/screenshots/ScreenshotsOverlayChild.sys.mjs  -> ScreenshotsOverlay
 *   browser/components/screenshots/overlayHelpers.mjs               -> Region, WindowDimensions, element picking
 *   browser/components/screenshots/screenshots-buttons.js           -> the "Save visible / Save full page" panel
 *   browser/components/screenshots/screenshots-preview.mjs          -> the preview dialog
 *   browser/components/screenshots/ScreenshotsUtils.sys.mjs         -> Foxshot controller
 *
 * Firefox renders the page with drawSnapshot(); extensions can only grab the
 * visible viewport, so regions bigger than the viewport are captured by
 * scrolling and stitching.
 *
 * This file is injected every time the toolbar button / shortcut is used. The
 * first injection sets everything up; later ones just toggle.
 */

(() => {
  "use strict";

  if (globalThis.__foxshot) {
    globalThis.__foxshot.toggle();
    return;
  }

  /* ------------------------------------------------------------------ */
  /* Strings (browser/locales/en-US/browser/screenshots.ftl)            */
  /* ------------------------------------------------------------------ */

  const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform);
  const ACCEL = IS_MAC ? "⌘" : "Ctrl+";
  const COPY_KEY = "C";
  const DOWNLOAD_KEY = "S";

  const L10N = {
    instructions: "Drag or click on the page to select a region. Press ESC to cancel.",
    cancel: "Cancel",
    cancelTitle: IS_MAC ? "Cancel (esc)" : "Cancel (Esc)",
    saveVisible: "Save visible",
    saveFullPage: "Save full page",
    copy: "Copy",
    copyTitle: `Copy (${ACCEL}${COPY_KEY})`,
    download: "Download",
    downloadTitle: `Download (${ACCEL}${DOWNLOAD_KEY})`,
    retryTitle: "Retry screenshot",
    previewFaceLabel: "Select this region",
    copied: "Screenshot copied!",
    tooLargeTitle: "Your screenshot was cropped because it was too large",
    selectionSize: (w, h) => `${w} × ${h}`,
  };

  /* ------------------------------------------------------------------ */
  /* Icons (Firefox proton icons, MPL 2.0)                              */
  /* ------------------------------------------------------------------ */

  const ICON_PATHS = {
    close:
      '<path d="m9.108 7.776 4.709-4.709a.626.626 0 0 0-.884-.885L8.244 6.871l-.488 0-4.689-4.688a.625.625 0 1 0-.884.885L6.87 7.754l0 .491-4.687 4.687a.626.626 0 0 0 .884.885L7.754 9.13l.491 0 4.687 4.687a.627.627 0 0 0 .885 0 .626.626 0 0 0 0-.885L9.108 8.223l0-.447z"/>',
    copy:
      '<path d="M6.035 1.25c-1 0-1.812.812-1.812 1.813h1.5c0-.173.14-.313.312-.313h5.95c.172 0 .313.14.313.313v7.65c0 .172-.14.312-.313.312v1.5c1 0 1.813-.812 1.813-1.813v-7.65c0-1-.812-1.812-1.813-1.812h-5.95z"/><path fill-rule="evenodd" clip-rule="evenodd" d="M3.063 4.225c-1.001 0-1.813.812-1.813 1.813v7.65c0 1 .812 1.812 1.813 1.812h5.95c1 0 1.812-.812 1.812-1.812v-7.65c0-1.001-.812-1.813-1.813-1.813h-5.95zM2.75 6.038c0-.173.14-.313.313-.313h5.95c.172 0 .312.14.312.313v7.65c0 .172-.14.312-.313.312h-5.95a.313.313 0 0 1-.312-.312v-7.65z"/>',
    download:
      '<path d="M8.25.625a.625.625 0 0 0-1.25 0l0 8.323-3.308-3.309a.626.626 0 0 0-.885.885L7.285 11l.681 0 4.477-4.476a.626.626 0 0 0-.885-.885L8.25 8.947l0-8.322z"/><path d="M12.25 15a2 2 0 0 0 2-2l0-1.375a.625.625 0 0 0-1.25 0l0 1.525-.6.6-9.55 0-.6-.6 0-1.525a.625.625 0 0 0-1.25 0L1 13a2 2 0 0 0 2 2l9.25 0z"/>',
    reload:
      '<path d="M10.707 6 14.7 6l.3-.3 0-3.993a.5.5 0 0 0-.854-.354l-1.459 1.459A6.95 6.95 0 0 0 8 1C4.141 1 1 4.141 1 8s3.141 7 7 7a6.97 6.97 0 0 0 6.968-6.322.626.626 0 0 0-.562-.682.635.635 0 0 0-.682.562A5.726 5.726 0 0 1 8 13.75c-3.171 0-5.75-2.579-5.75-5.75S4.829 2.25 8 2.25a5.71 5.71 0 0 1 3.805 1.445l-1.451 1.451a.5.5 0 0 0 .353.854z"/>',
  };

  const icon = name =>
    `<svg class="icon" viewBox="0 0 16 16" aria-hidden="true">${ICON_PATHS[name]}</svg>`;

  // browser/components/screenshots/content/menu-visible.svg
  const MENU_VISIBLE_SVG = `<svg class="panel-icon" viewBox="0 0 46 46" aria-hidden="true"><path d="M5 12c0-.6.5-1 1-1h34c.6 0 1 .5 1 1v24c0 .6-.5 1-1 1H6c-.6 0-1-.5-1-1V12zm2 23V13h32v22H7z" class="ctx-fill"/><path d="M7 35h32V13H7z" class="ctx-stroke"/><path d="M38 19h1v-2h-1v2zm0 3h1v-2h-1v2zm0 3h1v-2h-1v2zm0 3h1v-2h-1v2zm0 3h1v-2h-1v2zm0 3h1v-2h-1v2zm-1 1h2v-1h-2v1zm-3 0h2v-1h-2v1zm-3 0h2v-1h-2v1zm-3 0h2v-1h-2v1zm-3 0h2v-1h-2v1zm-3 0h2v-1h-2v1zm-3 0h2v-1h-2v1zm-3 0h2v-1h-2v1zm-3 0h2v-1h-2v1zm-3 0h2v-1h-2v1zm-2-3H7v3h2v-1H8v-2zm-1-1h1v-2H7v2zm0-3h1v-2H7v2zm0-3h1v-2H7v2zm0-3h1v-2H7v2zm0-3h1v-2H7v2zm2-6H7v3h1v-2h1v-1zm1 1h2v-1h-2v1zm3 0h2v-1h-2v1zm3 0h2v-1h-2v1zm3 0h2v-1h-2v1zm3 0h2v-1h-2v1zm3 0h2v-1h-2v1zm3 0h2v-1h-2v1zm3 0h2v-1h-2v1zm3 0h2v-1h-2v1zm5-1h-2v1h1v2h1v-3z" class="ctx-fill" opacity="0.5"/></svg>`;

  // browser/components/screenshots/content/menu-fullpage.svg
  const MENU_FULLPAGE_SVG = `<svg class="panel-icon" viewBox="0 0 46 46" aria-hidden="true"><path d="M7 42h32V5.1H7z" class="ctx-stroke"/><g transform="translate(0 6)"><path d="M40 5c.5 0 1 .4 1 1v24c0 .5-.5 1-1 1H6c-.6 0-1-.5-1-1V6c0-.6.4-1 1-1h34zM7 29h32V7H7v22z" class="ctx-fill"/><path class="ctx-fill" d="M7 7h32V5H7z"/><path class="ctx-fill" d="M7 31h32v-2H7z"/></g><path d="M38 11h1V9h-1v2zm0 3h1v-2h-1v2zm0 3h1v-2h-1v2zm0 3h1v-2h-1v2zm0 3h1v-2h-1v2zm0 3h1v-2h-1v2zm0 3h1v-2h-1v2zm0 3h1v-2h-1v2zm0 3h1v-2h-1v2zm0 3h1v-2h-1v2zm0 3h1v-2h-1v2zm-1 1h2v-1h-2v1zm-3 0h2v-1h-2v1zm-3 0h2v-1h-2v1zm-3 0h2v-1h-2v1zm-3 0h2v-1h-2v1zm-3 0h2v-1h-2v1zm-3 0h2v-1h-2v1zm-3 0h2v-1h-2v1zm-3 0h2v-1h-2v1zm-3 0h2v-1h-2v1zm-2-3H7v3h2v-1H8v-2zm-1-1h1v-2H7v2zm0-3h1v-2H7v2zm0-3h1v-2H7v2zm0-3h1v-2H7v2zm0-3h1v-2H7v2zm0-3h1v-2H7v2zm0-3h1v-2H7v2zm0-3h1v-2H7v2zm0-3h1v-2H7v2zm0-3h1V9H7v2zm2-6H7v3h1V6h1V5zm1 1h2V5h-2v1zm3 0h2V5h-2v1zm3 0h2V5h-2v1zm3 0h2V5h-2v1zm3 0h2V5h-2v1zm3 0h2V5h-2v1zm3 0h2V5h-2v1zm3 0h2V5h-2v1zm3 0h2V5h-2v1zm3 0h2V5h-2v1zm5-1h-2v1h1v2h1V5z" class="ctx-fill" opacity="0.5"/></svg>`;

  // browser/themes/shared/icons/success-animation.svg (19 frames, 16px each)
  const SUCCESS_ANIMATION_FRAMES = [
    "", "", "",
    "m2.419 8.83-.668-.668",
    "M2.957 9.368 1.751 8.162",
    "M3.657 10.068 1.751 8.162",
    "M4.507 10.918 1.751 8.162",
    "M5.565 11.804a2 2 0 0 1-.573-.401L1.751 8.162",
    "M7.051 11.882a2 2 0 0 1-2.059-.479L1.751 8.162",
    "m8.304 10.919-.484.484a2 2 0 0 1-2.828 0L1.751 8.162",
    "M9.434 9.789 7.82 11.403a2 2 0 0 1-2.828 0L1.751 8.162",
    "M10.512 8.711 7.82 11.403a2 2 0 0 1-2.828 0L1.751 8.162",
    "M11.494 7.729 7.82 11.403a2 2 0 0 1-2.828 0L1.751 8.162",
    "M12.344 6.879 7.82 11.403a2 2 0 0 1-2.828 0L1.751 8.162",
    "M13.044 6.179 7.82 11.403a2 2 0 0 1-2.828 0L1.751 8.162",
    "M13.582 5.641 7.82 11.403a2 2 0 0 1-2.828 0L1.751 8.162",
    "M13.959 5.264 7.82 11.403a2 2 0 0 1-2.828 0L1.751 8.162",
    "M14.179 5.044 7.82 11.403a2 2 0 0 1-2.828 0L1.751 8.162",
    "m14.25 4.973-6.43 6.43a2 2 0 0 1-2.828 0L1.751 8.162",
  ];
  const SUCCESS_ANIMATION_SVG =
    `<svg id="confirmation-hint-checkmark-image" xmlns="http://www.w3.org/2000/svg" width="304" height="16" aria-hidden="true">` +
    SUCCESS_ANIMATION_FRAMES.map(
      (d, i) =>
        `<svg width="16" height="16" x="${i * 16}" viewBox="0 0 16 16">` +
        (d
          ? `<path fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="${d}"/>`
          : "") +
        `</svg>`
    ).join("") +
    `</svg>`;

  /* ------------------------------------------------------------------ */
  /* overlayHelpers.mjs                                                 */
  /* ------------------------------------------------------------------ */

  // An autoselection smaller than these will be ignored entirely:
  const MIN_DETECT_ABSOLUTE_HEIGHT = 10;
  const MIN_DETECT_ABSOLUTE_WIDTH = 30;
  // An autoselection smaller than these will not be preferred:
  const MIN_DETECT_HEIGHT = 30;
  const MIN_DETECT_WIDTH = 100;
  // An autoselection bigger than either of these will be ignored:
  let MAX_DETECT_HEIGHT = 700;
  let MAX_DETECT_WIDTH = 1000;

  const doNotAutoselectTags = {
    H1: true,
    H2: true,
    H3: true,
    H4: true,
    H5: true,
    H6: true,
  };

  function getBoundingClientRect(ele) {
    if (!ele?.getBoundingClientRect) {
      return null;
    }
    return ele.getBoundingClientRect();
  }

  function setMaxDetectHeight(maxHeight) {
    MAX_DETECT_HEIGHT = maxHeight;
  }

  function setMaxDetectWidth(maxWidth) {
    MAX_DETECT_WIDTH = maxWidth;
  }

  function isFrameElement(ele) {
    return ele && (ele.tagName === "IFRAME" || ele.tagName === "FRAME");
  }

  /**
   * Find the element at a point. Same-origin iframes are searched for the
   * best element inside them (Firefox does this for every frame through a
   * JSWindowActor; cross-origin frames are opaque to extensions' top-frame
   * script, so those just get picked as a whole).
   */
  function getElementFromPoint(x, y, doc) {
    let ele = null;
    let rect = null;
    try {
      ele = doc.elementFromPoint(x, y);
      if (isFrameElement(ele)) {
        let innerDoc = null;
        try {
          innerDoc = ele.contentDocument;
        } catch (e) {
          // cross-origin
        }
        if (innerDoc) {
          let frameRect = ele.getBoundingClientRect();
          let style = ele.ownerDocument.defaultView.getComputedStyle(ele);
          let offsetX = frameRect.left + ele.clientLeft + parseFloat(style.paddingLeft || 0);
          let offsetY = frameRect.top + ele.clientTop + parseFloat(style.paddingTop || 0);
          let inner = getElementFromPoint(x - offsetX, y - offsetY, innerDoc);
          let innerRect = inner.rect || getBestRectForElement(inner.ele, innerDoc);
          if (innerRect) {
            rect = new DOMRect(
              innerRect.left + offsetX,
              innerRect.top + offsetY,
              innerRect.width,
              innerRect.height
            );
          }
        }
      } else if (ele?.shadowRoot) {
        while (ele.shadowRoot) {
          let shadowEle = ele.shadowRoot.elementFromPoint(x, y);
          if (shadowEle && shadowEle !== ele) {
            ele = shadowEle;
          } else {
            break;
          }
        }
      }
    } catch (e) {
      console.error(e);
    }

    return { ele, rect };
  }

  /**
   * This function takes an element and finds a suitable rect to draw the hover box on
   */
  function getBestRectForElement(ele, doc) {
    let lastRect;
    let lastNode;
    let rect;
    let attemptExtend = false;
    let node = ele;
    while (node) {
      rect = getBoundingClientRect(node);
      if (!rect) {
        rect = lastRect;
        break;
      }
      if (rect.width < MIN_DETECT_WIDTH || rect.height < MIN_DETECT_HEIGHT) {
        // Avoid infinite loop for elements with zero or nearly zero height,
        // like non-clearfixed float parents with or without borders.
        break;
      }
      if (rect.width > MAX_DETECT_WIDTH || rect.height > MAX_DETECT_HEIGHT) {
        // Then the last rectangle is better
        rect = lastRect;
        attemptExtend = true;
        break;
      }
      if (rect.width >= MIN_DETECT_WIDTH && rect.height >= MIN_DETECT_HEIGHT) {
        if (!doNotAutoselectTags[node.tagName]) {
          break;
        }
      }
      lastRect = rect;
      lastNode = node;
      node = node.parentNode;
    }
    if (rect && node) {
      const evenBetter = evenBetterElement(node, doc);
      if (evenBetter) {
        node = lastNode = evenBetter;
        rect = getBoundingClientRect(evenBetter);
        attemptExtend = false;
      }
    }
    if (rect && attemptExtend && lastNode) {
      let extendNode = lastNode.nextSibling;
      while (extendNode) {
        if (extendNode.nodeType === doc.ELEMENT_NODE) {
          break;
        }
        extendNode = extendNode.nextSibling;
        if (!extendNode) {
          const parentNode = lastNode.parentNode;
          for (let i = 0; i < parentNode.childNodes.length; i++) {
            if (parentNode.childNodes[i] === lastNode) {
              extendNode = parentNode.childNodes[i + 1];
            }
          }
        }
      }
      if (extendNode) {
        const extendRect = getBoundingClientRect(extendNode);
        if (extendRect) {
          let x = Math.min(rect.x, extendRect.x);
          let y = Math.min(rect.y, extendRect.y);
          let width = Math.max(rect.right, extendRect.right) - x;
          let height = Math.max(rect.bottom, extendRect.bottom) - y;
          const combinedRect = new DOMRect(x, y, width, height);
          if (
            combinedRect.width <= MAX_DETECT_WIDTH &&
            combinedRect.height <= MAX_DETECT_HEIGHT
          ) {
            rect = combinedRect;
          }
        }
      }
    }

    if (
      rect &&
      (rect.width < MIN_DETECT_ABSOLUTE_WIDTH ||
        rect.height < MIN_DETECT_ABSOLUTE_HEIGHT)
    ) {
      rect = null;
    }

    return rect;
  }

  /**
   * This finds a better element by looking for elements with role article
   */
  function evenBetterElement(node, doc) {
    let el = node.parentNode;
    const ELEMENT_NODE = doc.ELEMENT_NODE;
    while (el && el.nodeType === ELEMENT_NODE) {
      if (!el.getAttribute) {
        return null;
      }
      if (el.getAttribute("role") === "article") {
        const rect = getBoundingClientRect(el);
        if (!rect) {
          return null;
        }
        if (rect.width <= MAX_DETECT_WIDTH && rect.height <= MAX_DETECT_HEIGHT) {
          return el;
        }
        return null;
      }
      el = el.parentNode;
    }
    return null;
  }

  class Region {
    #x1;
    #x2;
    #y1;
    #y2;
    #windowDimensions;

    constructor(windowDimensions) {
      this.resetDimensions();
      this.#windowDimensions = windowDimensions;
    }

    #clampX(val) {
      return Math.min(this.#windowDimensions.scrollWidth, Math.max(0, val));
    }

    #clampY(val) {
      return Math.min(this.#windowDimensions.scrollHeight, Math.max(0, val));
    }

    set dimensions(dims) {
      if (dims == null) {
        this.resetDimensions();
        return;
      }
      if (dims.left != null) {
        this.left = dims.left;
      }
      if (dims.top != null) {
        this.top = dims.top;
      }
      if (dims.right != null) {
        this.right = dims.right;
      }
      if (dims.bottom != null) {
        this.bottom = dims.bottom;
      }
    }

    setDimensionsFromDOMRect(rect) {
      if (rect == null) {
        this.resetDimensions();
        return;
      }
      let { scrollX, scrollY } = this.#windowDimensions.dimensions;
      let { left, top, right, bottom } = rect;
      this.dimensions = {
        left: left + scrollX,
        top: top + scrollY,
        right: right + scrollX,
        bottom: bottom + scrollY,
      };
    }

    get dimensions() {
      return {
        left: this.left,
        top: this.top,
        right: this.right,
        bottom: this.bottom,
        width: this.width,
        height: this.height,
      };
    }

    get isRegionValid() {
      return this.#x1 + this.#x2 + this.#y1 + this.#y2 > 0;
    }

    resetDimensions() {
      this.#x1 = 0;
      this.#x2 = 0;
      this.#y1 = 0;
      this.#y2 = 0;
    }

    sortCoords() {
      if (this.#x1 > this.#x2) {
        [this.#x1, this.#x2] = [this.#x2, this.#x1];
      }
      if (this.#y1 > this.#y2) {
        [this.#y1, this.#y2] = [this.#y2, this.#y1];
      }
    }

    shift() {
      let didShift = false;
      let xDiff = this.right - this.#windowDimensions.scrollWidth;
      if (xDiff > 0) {
        this.left -= xDiff;
        this.right -= xDiff;
        didShift = true;
      }
      let yDiff = this.bottom - this.#windowDimensions.scrollHeight;
      if (yDiff > 0) {
        this.top -= yDiff;
        this.bottom -= yDiff;
        didShift = true;
      }
      return didShift;
    }

    get distance() {
      return Math.sqrt(Math.pow(this.width, 2) + Math.pow(this.height, 2));
    }

    get top() {
      return Math.min(this.#y1, this.#y2);
    }
    set top(val) {
      this.#y1 = this.#clampY(val);
    }

    get left() {
      return Math.min(this.#x1, this.#x2);
    }
    set left(val) {
      this.#x1 = this.#clampX(val);
    }

    get right() {
      return Math.max(this.#x1, this.#x2);
    }
    set right(val) {
      this.#x2 = this.#clampX(val);
    }

    get bottom() {
      return Math.max(this.#y1, this.#y2);
    }
    set bottom(val) {
      this.#y2 = this.#clampY(val);
    }

    get width() {
      return Math.abs(this.#x2 - this.#x1);
    }
    get height() {
      return Math.abs(this.#y2 - this.#y1);
    }

    get x1() {
      return this.#x1;
    }
    get x2() {
      return this.#x2;
    }
    get y1() {
      return this.#y1;
    }
    get y2() {
      return this.#y2;
    }
  }

  class WindowDimensions {
    #clientHeight = null;
    #clientWidth = null;
    #scrollHeight = null;
    #scrollWidth = null;
    #scrollX = null;
    #scrollY = null;
    #scrollMinX = null;
    #scrollMinY = null;
    #scrollMaxX = null;
    #scrollMaxY = null;
    #devicePixelRatio = null;

    set dimensions(d) {
      if (d.clientHeight != null) this.#clientHeight = d.clientHeight;
      if (d.clientWidth != null) this.#clientWidth = d.clientWidth;
      if (d.scrollHeight != null) this.#scrollHeight = d.scrollHeight;
      if (d.scrollWidth != null) this.#scrollWidth = d.scrollWidth;
      if (d.scrollX != null) this.#scrollX = d.scrollX;
      if (d.scrollY != null) this.#scrollY = d.scrollY;
      if (d.scrollMinX != null) this.#scrollMinX = d.scrollMinX;
      if (d.scrollMinY != null) this.#scrollMinY = d.scrollMinY;
      if (d.scrollMaxX != null) this.#scrollMaxX = d.scrollMaxX;
      if (d.scrollMaxY != null) this.#scrollMaxY = d.scrollMaxY;
      if (d.devicePixelRatio != null) this.#devicePixelRatio = d.devicePixelRatio;
    }

    get dimensions() {
      return {
        clientHeight: this.clientHeight,
        clientWidth: this.clientWidth,
        scrollHeight: this.scrollHeight,
        scrollWidth: this.scrollWidth,
        scrollX: this.scrollX,
        scrollY: this.scrollY,
        pageScrollX: this.pageScrollX,
        pageScrollY: this.pageScrollY,
        scrollMinX: this.scrollMinX,
        scrollMinY: this.scrollMinY,
        scrollMaxX: this.scrollMaxX,
        scrollMaxY: this.scrollMaxY,
        devicePixelRatio: this.devicePixelRatio,
      };
    }

    get clientWidth() {
      return this.#clientWidth;
    }
    get clientHeight() {
      return this.#clientHeight;
    }
    get scrollWidth() {
      return this.#scrollWidth;
    }
    get scrollHeight() {
      return this.#scrollHeight;
    }
    get scrollX() {
      return this.#scrollX - this.scrollMinX;
    }
    get pageScrollX() {
      return this.#scrollX;
    }
    get scrollY() {
      return this.#scrollY - this.scrollMinY;
    }
    get pageScrollY() {
      return this.#scrollY;
    }
    get scrollMinX() {
      return this.#scrollMinX;
    }
    get scrollMinY() {
      return this.#scrollMinY;
    }
    get scrollMaxX() {
      return this.#scrollMaxX;
    }
    get scrollMaxY() {
      return this.#scrollMaxY;
    }
    get devicePixelRatio() {
      return this.#devicePixelRatio;
    }

    isInViewport(rect) {
      let { left, top, right, bottom } = rect;
      if (
        left > this.scrollX + this.clientWidth ||
        right < this.scrollX ||
        top > this.scrollY + this.clientHeight ||
        bottom < this.scrollY
      ) {
        return false;
      }
      return true;
    }

    reset() {
      this.#clientHeight = 0;
      this.#clientWidth = 0;
      this.#scrollHeight = 0;
      this.#scrollWidth = 0;
      this.#scrollX = 0;
      this.#scrollY = 0;
      this.#scrollMinX = 0;
      this.#scrollMinY = 0;
      this.#scrollMaxX = 0;
      this.#scrollMaxY = 0;
    }
  }

  /* ------------------------------------------------------------------ */
  /* ScreenshotsOverlayChild.sys.mjs                                    */
  /* ------------------------------------------------------------------ */

  /*
   * States:
   *  "crosshairs":    Nothing has happened, and the crosshairs will follow the movement of the mouse
   *  "draggingReady": The user has pressed the mouse button, but hasn't moved enough to create a selection
   *  "dragging":      The user has pressed down a mouse button, and is dragging out an area far enough to show a selection
   *  "selected":      The user has selected an area
   *  "resizing":      The user is resizing the selection
   */
  const STATES = {
    CROSSHAIRS: "crosshairs",
    DRAGGING_READY: "draggingReady",
    DRAGGING: "dragging",
    SELECTED: "selected",
    RESIZING: "resizing",
  };

  const SCROLL_BY_EDGE = 20;

  const FACE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
    <g>
      <path d="M11.4.9v2.9h-6c-.9 0-1.5.8-1.5 1.5v6H.8V3.8C.8 2.1 2.2.7 3.9.7h7.6v.2z" class="face-line-color"/>
      <path d="M63.2 11.4h-3.1v-6c0-.8-.6-1.5-1.5-1.5h-6v-3h7.6c1.7 0 3.1 1.4 3.1 3.1z" class="face-line-color"/>
      <path d="M52.6 63.2v-3.1h6c.9 0 1.5-.6 1.5-1.5v-6h3.1v7.6c0 1.7-1.4 3.1-3.1 3.1z" class="face-line-color"/>
      <path d="M.8 52.7h3.1v6c0 .9.6 1.5 1.5 1.5h6v3.1H3.8c-1.7 0-3.1-1.4-3.1-3.1z" class="face-line-color"/>
      <path d="M33.3 49.2H33c-4.6-.1-7.8-3.6-7.9-3.8-.6-.8-.6-2 .1-2.7.8-.8 1.9-.6 2.6.1 0 0 2.3 2.6 5.2 2.6 1.8 0 3.6-.9 5.2-2.6.8-.8 1.9-.8 2.7 0 .8.8.8 1.9 0 2.7-2.2 2.4-4.9 3.7-7.6 3.7z" class="face-line-color"/>
      <ellipse id="leftEye" cx="23" cy="26" class="face-line-color" rx="5" ry="7"/>
      <ellipse id="rightEye" cx="43" cy="26" class="face-line-color" rx="5" ry="7"/>
      <ellipse id="leftPupil" cx="25" cy="30" class="face-pupil-color" rx="3" ry="3"/>
      <ellipse id="rightPupil" cx="45" cy="30" class="face-pupil-color" rx="3" ry="3"/>
    </g>
  </svg>`;

  const focusVisible = (el, opts = {}) => el?.focus({ focusVisible: true, ...opts });

  class ScreenshotsOverlay {
    #initialized = false;
    #state = "";
    #moverId;
    #cachedEle;
    #lastPageX;
    #lastPageY;
    #lastClientX;
    #lastClientY;
    #previousDimensions;

    get markup() {
      return `
        <div id="screenshots-component">
          <div id="preview-container" hidden>
            <div id="face-container" tabindex="0" role="button" aria-label="${L10N.previewFaceLabel}">
              ${FACE_SVG}
            </div>
            <div class="preview-instructions">${L10N.instructions}</div>
            <button class="screenshots-button ghost-button" id="screenshots-cancel-button" title="${L10N.cancelTitle}" aria-label="${L10N.cancel}">${L10N.cancel}</button>
          </div>
          <div id="hover-highlight" hidden></div>
          <div id="selection-container" hidden>
            <div id="top-background" class="bghighlight"></div>
            <div id="bottom-background" class="bghighlight"></div>
            <div id="left-background" class="bghighlight"></div>
            <div id="right-background" class="bghighlight"></div>
            <div id="highlight" class="highlight" tabindex="0">
              <div id="mover-topLeft" class="mover-target direction-topLeft" tabindex="0"><div class="mover"></div></div>
              <div id="mover-top" class="mover-target direction-top"><div class="mover"></div></div>
              <div id="mover-topRight" class="mover-target direction-topRight" tabindex="0"><div class="mover"></div></div>
              <div id="mover-right" class="mover-target direction-right"><div class="mover"></div></div>
              <div id="mover-bottomRight" class="mover-target direction-bottomRight" tabindex="0"><div class="mover"></div></div>
              <div id="mover-bottom" class="mover-target direction-bottom"><div class="mover"></div></div>
              <div id="mover-bottomLeft" class="mover-target direction-bottomLeft" tabindex="0"><div class="mover"></div></div>
              <div id="mover-left" class="mover-target direction-left"><div class="mover"></div></div>
              <div id="selection-size-container">
                <span id="selection-size" dir="ltr"></span>
              </div>
            </div>
          </div>
          <div id="buttons-container" hidden>
            <div class="buttons-wrapper">
              <button id="cancel" class="screenshots-button" title="${L10N.cancelTitle}" aria-label="${L10N.cancel}">${icon("close")}</button>
              <button id="copy" class="screenshots-button" title="${L10N.copyTitle}" aria-label="${L10N.copy}">${icon("copy")}<label>${L10N.copy}</label></button>
              <button id="download" class="screenshots-button primary" title="${L10N.downloadTitle}" aria-label="${L10N.download}">${icon("download")}<label>${L10N.download}</label></button>
            </div>
          </div>
        </div>`;
    }

    constructor(controller, root) {
      this.controller = controller;
      this.root = root;
      this.document = document;
      this.window = window;
      this.windowDimensions = new WindowDimensions();
      this.selectionRegion = new Region(this.windowDimensions);
      this.hoverElementRegion = new Region(this.windowDimensions);
      this.copyKey = COPY_KEY;
      this.downloadKey = DOWNLOAD_KEY;
    }

    get initialized() {
      return this.#initialized;
    }

    get state() {
      return this.#state;
    }

    getElementById(id) {
      return this.root.getElementById(id);
    }

    initialize() {
      if (this.initialized) {
        return;
      }
      this.windowDimensions.reset();

      let template = document.createElement("template");
      template.innerHTML = this.markup;
      this.root.appendChild(template.content);

      this.initializeElements();
      this.screenshotsContainer.dir = "ltr";
      this.updateWindowDimensions();

      this.#setState(STATES.CROSSHAIRS);
      this.#initialized = true;
    }

    initializeElements() {
      this.previewCancelButton = this.getElementById("screenshots-cancel-button");
      this.cancelButton = this.getElementById("cancel");
      this.copyButton = this.getElementById("copy");
      this.downloadButton = this.getElementById("download");

      this.previewContainer = this.getElementById("preview-container");
      this.previewFace = this.getElementById("face-container");
      this.hoverElementContainer = this.getElementById("hover-highlight");
      this.selectionContainer = this.getElementById("selection-container");
      this.buttonsContainer = this.getElementById("buttons-container");
      this.screenshotsContainer = this.getElementById("screenshots-component");

      this.leftEye = this.getElementById("leftPupil");
      this.rightEye = this.getElementById("rightPupil");

      this.leftBackgroundEl = this.getElementById("left-background");
      this.topBackgroundEl = this.getElementById("top-background");
      this.rightBackgroundEl = this.getElementById("right-background");
      this.bottomBackgroundEl = this.getElementById("bottom-background");
      this.highlightEl = this.getElementById("highlight");

      this.topLeftMover = this.getElementById("mover-topLeft");
      this.topRightMover = this.getElementById("mover-topRight");
      this.bottomLeftMover = this.getElementById("mover-bottomLeft");
      this.bottomRightMover = this.getElementById("mover-bottomRight");

      this.selectionSize = this.getElementById("selection-size");
    }

    tearDown() {
      this.screenshotsContainer?.remove();
      this.#initialized = false;
      this.#state = "";
    }

    /** Elements that Tab cycles through for the current state. */
    get focusCycle() {
      switch (this.#state) {
        case STATES.CROSSHAIRS:
          return [
            this.previewFace,
            this.previewCancelButton,
            ...this.controller.panelButtons,
          ];
        case STATES.SELECTED:
          return [
            this.highlightEl,
            this.topLeftMover,
            this.topRightMover,
            this.bottomRightMover,
            this.bottomLeftMover,
            this.cancelButton,
            this.copyButton,
            this.downloadButton,
          ];
      }
      return [];
    }

    getCoordinatesFromEvent(event) {
      let { clientX, clientY, pageX, pageY } = event;
      pageX -= this.windowDimensions.scrollMinX;
      pageY -= this.windowDimensions.scrollMinY;
      return { clientX, clientY, pageX, pageY };
    }

    handleEvent(event, target) {
      switch (event.type) {
        case "click":
          // Touch taps on buttons are handled on touchend.
          if (event.pointerType !== "touch") {
            this.handleClick(event, target);
          }
          break;
        case "touchend":
          this.handleTouchEnd(event, target);
          break;
        case "pointerdown":
          this.handlePointerDown(event, target);
          break;
        case "pointermove":
          this.handlePointerMove(event, target);
          break;
        case "pointerup":
          this.handlePointerUp(event, target);
          break;
        case "keydown":
          this.handleKeyDown(event, target);
          break;
        case "keyup":
          this.handleKeyUp(event, target);
          break;
      }
    }

    /**
     * If the event came from the primary button, return false.
     * If the event had another button, set to the crosshairs or selected state
     * and return true to early return from the event handler function.
     */
    preEventHandler(event) {
      if (event.button > 0 || event.buttons > 1) {
        switch (this.#state) {
          case STATES.DRAGGING_READY:
            this.#setState(STATES.CROSSHAIRS);
            break;
          case STATES.DRAGGING:
          case STATES.RESIZING:
            this.#setState(STATES.SELECTED);
            break;
        }
        return true;
      }
      return false;
    }

    handleClick(event, target) {
      if (this.preEventHandler(event)) {
        return;
      }
      switch (target?.closest("button")?.id ?? target?.id) {
        case "screenshots-cancel-button":
        case "cancel":
          this.maybeCancelScreenshots();
          break;
        case "copy":
          this.copySelectedRegion();
          break;
        case "download":
          this.downloadSelectedRegion();
          break;
      }
    }

    handleTouchEnd(event, target) {
      if (
        target?.closest("#screenshots-cancel-button") ||
        target?.closest("#buttons-container") === this.buttonsContainer
      ) {
        this.handleClick(event, target);
      }
    }

    maybeCancelScreenshots() {
      if (this.#state === STATES.CROSSHAIRS) {
        this.controller.cancel();
      } else {
        this.#setState(STATES.CROSSHAIRS);
      }
    }

    handlePointerDown(event, target) {
      // Early return if the event target is not within the screenshots component.
      if (!target?.closest("#screenshots-component")) {
        return;
      }
      if (this.preEventHandler(event)) {
        return;
      }
      if (
        target.closest("#screenshots-cancel-button") ||
        target.closest("#buttons-container") === this.buttonsContainer
      ) {
        return;
      }

      const { pageX, pageY } = this.getCoordinatesFromEvent(event);

      switch (this.#state) {
        case STATES.CROSSHAIRS:
          this.crosshairsDragStart(pageX, pageY);
          break;
        case STATES.SELECTED:
          this.selectedDragStart(pageX, pageY, target.id);
          break;
      }
    }

    handlePointerMove(event) {
      if (this.preEventHandler(event)) {
        return;
      }
      const { pageX, pageY, clientX, clientY } = this.getCoordinatesFromEvent(event);

      switch (this.#state) {
        case STATES.CROSSHAIRS:
          this.crosshairsMove(clientX, clientY);
          break;
        case STATES.DRAGGING_READY:
          this.draggingReadyDrag(pageX, pageY);
          break;
        case STATES.DRAGGING:
          this.draggingDrag(pageX, pageY);
          break;
        case STATES.RESIZING:
          this.resizingDrag(pageX, pageY);
          break;
      }
    }

    handlePointerUp(event) {
      const { pageX, pageY } = this.getCoordinatesFromEvent(event);

      switch (this.#state) {
        case STATES.DRAGGING_READY:
          this.draggingReadyDragEnd();
          break;
        case STATES.DRAGGING:
          this.draggingDragEnd(pageX, pageY);
          break;
        case STATES.RESIZING:
          this.resizingDragEnd(pageX, pageY);
          break;
      }
    }

    handleKeyDown(event, target) {
      if (event.key === "Escape") {
        this.maybeCancelScreenshots();
        return;
      }

      switch (this.#state) {
        case STATES.CROSSHAIRS:
          this.crosshairsKeyDown(event, target);
          break;
        case STATES.DRAGGING:
          this.draggingKeyDown(event, target);
          break;
        case STATES.RESIZING:
          this.resizingKeyDown(event, target);
          break;
        case STATES.SELECTED:
          this.selectedKeyDown(event, target);
          break;
      }
    }

    handleKeyUp(event, target) {
      if (this.#state !== STATES.RESIZING) {
        return;
      }
      switch (event.key) {
        case "ArrowLeft":
        case "ArrowUp":
        case "ArrowRight":
        case "ArrowDown":
          switch (target?.id) {
            case "highlight":
            case "mover-bottomLeft":
            case "mover-bottomRight":
            case "mover-topLeft":
            case "mover-topRight":
              this.#setState(STATES.SELECTED, { doNotMoveFocus: true });
              break;
          }
          break;
      }
    }

    getAccelKey(event) {
      return IS_MAC ? event.metaKey : event.ctrlKey;
    }

    crosshairsKeyDown(event, target) {
      switch (event.key) {
        case "ArrowLeft":
        case "ArrowUp":
        case "ArrowRight":
        case "ArrowDown":
          break;
        case "Tab":
          this.controller.cycleFocus(event.shiftKey);
          return;
        case "Enter":
          if (this.handleKeyDownOnButton(target)) {
            return;
          }
          if (this.hoverElementRegion.isRegionValid) {
            this.draggingReadyStart();
            this.draggingReadyDragEnd();
            return;
          }
        // eslint-disable-next-line no-fallthrough
        case " ": {
          if (this.handleKeyDownOnButton(target)) {
            return;
          }

          // If the preview face is focused, create a region from the preview
          // face and move focus to the bottom right mover for adjustments
          if (target === this.previewFace) {
            let rect = this.previewFace.getBoundingClientRect();
            this.hoverElementRegion.setDimensionsFromDOMRect(rect);
            this.draggingReadyStart();
            this.draggingReadyDragEnd({ doNotMoveFocus: true });
            focusVisible(this.bottomRightMover);
            return;
          }

          if (this.#lastClientX == null) {
            return;
          }
          this.crosshairsDragStart(
            this.#lastClientX + this.windowDimensions.scrollX,
            this.#lastClientY + this.windowDimensions.scrollY
          );
          this.#setState(STATES.DRAGGING);
          break;
        }
      }
    }

    draggingKeyDown(event, target) {
      switch (event.key) {
        case "ArrowLeft":
          this.handleArrowLeftKeyDown(event, target);
          break;
        case "ArrowUp":
          this.handleArrowUpKeyDown(event, target);
          break;
        case "ArrowRight":
          this.handleArrowRightKeyDown(event, target);
          break;
        case "ArrowDown":
          this.handleArrowDownKeyDown(event, target);
          break;
        case "Enter":
        case " ":
          this.#setState(STATES.SELECTED);
          return;
        default:
          return;
      }
      this.drawSelectionContainer();
    }

    resizingKeyDown(event, target) {
      switch (event.key) {
        case "ArrowLeft":
          this.resizingArrowLeftKeyDown(event, target);
          break;
        case "ArrowUp":
          this.resizingArrowUpKeyDown(event, target);
          break;
        case "ArrowRight":
          this.resizingArrowRightKeyDown(event, target);
          break;
        case "ArrowDown":
          this.resizingArrowDownKeyDown(event, target);
          break;
      }
    }

    selectedKeyDown(event, target) {
      let isSelectionElement = target?.closest("#selection-container");
      switch (event.key) {
        case "ArrowLeft":
          if (isSelectionElement) {
            this.resizingArrowLeftKeyDown(event, target);
          }
          break;
        case "ArrowUp":
          if (isSelectionElement) {
            this.resizingArrowUpKeyDown(event, target);
          }
          break;
        case "ArrowRight":
          if (isSelectionElement) {
            this.resizingArrowRightKeyDown(event, target);
          }
          break;
        case "ArrowDown":
          if (isSelectionElement) {
            this.resizingArrowDownKeyDown(event, target);
          }
          break;
        case "Tab":
          this.controller.cycleFocus(event.shiftKey);
          break;
        case "Enter":
        case " ":
          this.handleKeyDownOnButton(target);
          break;
        case this.copyKey.toLowerCase():
          if (this.state === STATES.SELECTED && this.getAccelKey(event)) {
            this.copySelectedRegion();
          }
          break;
        case this.downloadKey.toLowerCase():
          if (this.state === STATES.SELECTED && this.getAccelKey(event)) {
            this.downloadSelectedRegion();
          }
          break;
      }
    }

    resizingArrowLeftKeyDown(event, target) {
      this.handleArrowLeftKeyDown(event, target);
      if (this.#state !== STATES.RESIZING) {
        this.#setState(STATES.RESIZING);
      }
      this.drawSelectionContainer();
    }

    /**
     * Move the region or its left or right side to the left.
     * Just the arrow key will move the region by 1px.
     * Arrow key + shift will move the region by 10px.
     * Arrow key + control/meta will move to the edge of the window.
     */
    handleArrowLeftKeyDown(event, target) {
      let exponent = event.shiftKey ? 1 : 0;
      switch (target?.id) {
        case "highlight":
          if (this.getAccelKey(event)) {
            let width = this.selectionRegion.width;
            this.selectionRegion.left = this.windowDimensions.scrollX;
            this.selectionRegion.right = this.windowDimensions.scrollX + width;
            break;
          }
          this.selectionRegion.right -= 10 ** exponent;
        // eslint-disable-next-line no-fallthrough
        case "mover-topLeft":
        case "mover-bottomLeft":
          if (this.getAccelKey(event)) {
            this.selectionRegion.left = this.windowDimensions.scrollX;
            break;
          }
          this.selectionRegion.left -= 10 ** exponent;
          this.scrollIfByEdge(
            this.selectionRegion.left,
            this.windowDimensions.scrollY + this.windowDimensions.clientHeight / 2
          );
          break;
        case "mover-topRight":
        case "mover-bottomRight":
          if (this.getAccelKey(event)) {
            let left = this.selectionRegion.left;
            this.selectionRegion.left = this.windowDimensions.scrollX;
            this.selectionRegion.right = left;
            if (target.id === "mover-topRight") {
              focusVisible(this.topLeftMover);
            } else if (target.id === "mover-bottomRight") {
              focusVisible(this.bottomLeftMover);
            }
            break;
          }
          this.selectionRegion.right -= 10 ** exponent;
          if (this.selectionRegion.x1 >= this.selectionRegion.x2) {
            this.selectionRegion.sortCoords();
            if (target.id === "mover-topRight") {
              focusVisible(this.topLeftMover);
            } else if (target.id === "mover-bottomRight") {
              focusVisible(this.bottomLeftMover);
            }
          }
          break;
      }
    }

    resizingArrowUpKeyDown(event, target) {
      this.handleArrowUpKeyDown(event, target);
      if (this.#state !== STATES.RESIZING) {
        this.#setState(STATES.RESIZING);
      }
      this.drawSelectionContainer();
    }

    handleArrowUpKeyDown(event, target) {
      let exponent = event.shiftKey ? 1 : 0;
      switch (target?.id) {
        case "highlight":
          if (this.getAccelKey(event)) {
            let height = this.selectionRegion.height;
            this.selectionRegion.top = this.windowDimensions.scrollY;
            this.selectionRegion.bottom = this.windowDimensions.scrollY + height;
            break;
          }
          this.selectionRegion.bottom -= 10 ** exponent;
        // eslint-disable-next-line no-fallthrough
        case "mover-topLeft":
        case "mover-topRight":
          if (this.getAccelKey(event)) {
            this.selectionRegion.top = this.windowDimensions.scrollY;
            break;
          }
          this.selectionRegion.top -= 10 ** exponent;
          this.scrollIfByEdge(
            this.windowDimensions.scrollX + this.windowDimensions.clientWidth / 2,
            this.selectionRegion.top
          );
          break;
        case "mover-bottomLeft":
        case "mover-bottomRight":
          if (this.getAccelKey(event)) {
            let top = this.selectionRegion.top;
            this.selectionRegion.top = this.windowDimensions.scrollY;
            this.selectionRegion.bottom = top;
            if (target.id === "mover-bottomLeft") {
              focusVisible(this.topLeftMover);
            } else if (target.id === "mover-bottomRight") {
              focusVisible(this.topRightMover);
            }
            break;
          }
          this.selectionRegion.bottom -= 10 ** exponent;
          if (this.selectionRegion.y1 >= this.selectionRegion.y2) {
            this.selectionRegion.sortCoords();
            if (target.id === "mover-bottomLeft") {
              focusVisible(this.topLeftMover);
            } else if (target.id === "mover-bottomRight") {
              focusVisible(this.topRightMover);
            }
          }
          break;
      }
    }

    resizingArrowRightKeyDown(event, target) {
      this.handleArrowRightKeyDown(event, target);
      if (this.#state !== STATES.RESIZING) {
        this.#setState(STATES.RESIZING);
      }
      this.drawSelectionContainer();
    }

    handleArrowRightKeyDown(event, target) {
      let exponent = event.shiftKey ? 1 : 0;
      switch (target?.id) {
        case "highlight":
          if (this.getAccelKey(event)) {
            let width = this.selectionRegion.width;
            let { scrollX, clientWidth } = this.windowDimensions.dimensions;
            this.selectionRegion.right = scrollX + clientWidth;
            this.selectionRegion.left = this.selectionRegion.right - width;
            break;
          }
          this.selectionRegion.left += 10 ** exponent;
        // eslint-disable-next-line no-fallthrough
        case "mover-topRight":
        case "mover-bottomRight":
          if (this.getAccelKey(event)) {
            this.selectionRegion.right =
              this.windowDimensions.scrollX + this.windowDimensions.clientWidth;
            break;
          }
          this.selectionRegion.right += 10 ** exponent;
          this.scrollIfByEdge(
            this.selectionRegion.right,
            this.windowDimensions.scrollY + this.windowDimensions.clientHeight / 2
          );
          break;
        case "mover-topLeft":
        case "mover-bottomLeft":
          if (this.getAccelKey(event)) {
            let right = this.selectionRegion.right;
            this.selectionRegion.right =
              this.windowDimensions.scrollX + this.windowDimensions.clientWidth;
            this.selectionRegion.left = right;
            if (target.id === "mover-topLeft") {
              focusVisible(this.topRightMover);
            } else if (target.id === "mover-bottomLeft") {
              focusVisible(this.bottomRightMover);
            }
            break;
          }
          this.selectionRegion.left += 10 ** exponent;
          if (this.selectionRegion.x1 >= this.selectionRegion.x2) {
            this.selectionRegion.sortCoords();
            if (target.id === "mover-topLeft") {
              focusVisible(this.topRightMover);
            } else if (target.id === "mover-bottomLeft") {
              focusVisible(this.bottomRightMover);
            }
          }
          break;
      }
    }

    resizingArrowDownKeyDown(event, target) {
      this.handleArrowDownKeyDown(event, target);
      if (this.#state !== STATES.RESIZING) {
        this.#setState(STATES.RESIZING);
      }
      this.drawSelectionContainer();
    }

    handleArrowDownKeyDown(event, target) {
      let exponent = event.shiftKey ? 1 : 0;
      switch (target?.id) {
        case "highlight":
          if (this.getAccelKey(event)) {
            let height = this.selectionRegion.height;
            let { scrollY, clientHeight } = this.windowDimensions.dimensions;
            this.selectionRegion.bottom = scrollY + clientHeight;
            this.selectionRegion.top = this.selectionRegion.bottom - height;
            break;
          }
          this.selectionRegion.top += 10 ** exponent;
        // eslint-disable-next-line no-fallthrough
        case "mover-bottomLeft":
        case "mover-bottomRight":
          if (this.getAccelKey(event)) {
            this.selectionRegion.bottom =
              this.windowDimensions.scrollY + this.windowDimensions.clientHeight;
            break;
          }
          this.selectionRegion.bottom += 10 ** exponent;
          this.scrollIfByEdge(
            this.windowDimensions.scrollX + this.windowDimensions.clientWidth / 2,
            this.selectionRegion.bottom
          );
          break;
        case "mover-topLeft":
        case "mover-topRight":
          if (this.getAccelKey(event)) {
            let bottom = this.selectionRegion.bottom;
            this.selectionRegion.bottom =
              this.windowDimensions.scrollY + this.windowDimensions.clientHeight;
            this.selectionRegion.top = bottom;
            if (target.id === "mover-topLeft") {
              focusVisible(this.bottomLeftMover);
            } else if (target.id === "mover-topRight") {
              focusVisible(this.bottomRightMover);
            }
            break;
          }
          this.selectionRegion.top += 10 ** exponent;
          if (this.selectionRegion.y1 >= this.selectionRegion.y2) {
            this.selectionRegion.sortCoords();
            if (target.id === "mover-topLeft") {
              focusVisible(this.bottomLeftMover);
            } else if (target.id === "mover-topRight") {
              focusVisible(this.bottomRightMover);
            }
          }
          break;
      }
    }

    /**
     * Set the focus to the most recent saved method.
     * This will default to the download button.
     */
    setFocusToActionButton() {
      if (this.controller.lastSavedMethod === "copy") {
        focusVisible(this.copyButton, { preventScroll: true });
      } else {
        focusVisible(this.downloadButton, { preventScroll: true });
      }
    }

    /**
     * Keydown on our own buttons (all events are prevented, so Enter/Space
     * on a focused button has to be handled explicitly).
     *
     * @returns {boolean} True if the event was handled here, otherwise false.
     */
    handleKeyDownOnButton(target) {
      switch (target) {
        case this.cancelButton:
        case this.previewCancelButton:
          this.maybeCancelScreenshots();
          break;
        case this.copyButton:
          this.copySelectedRegion();
          break;
        case this.downloadButton:
          this.downloadSelectedRegion();
          break;
        default:
          return false;
      }
      return true;
    }

    #setState(newState, options = {}) {
      if (newState !== this.#state) {
        let hasSelection = [
          STATES.DRAGGING_READY,
          STATES.DRAGGING,
          STATES.RESIZING,
          STATES.SELECTED,
        ].includes(newState);
        this.screenshotsContainer.toggleAttribute(
          "dragging",
          newState === STATES.DRAGGING || newState === STATES.RESIZING
        );
        this.controller.onOverlaySelection(hasSelection);
      }
      this.#state = newState;

      switch (this.#state) {
        case STATES.CROSSHAIRS:
          this.crosshairsStart();
          break;
        case STATES.DRAGGING_READY:
          this.draggingReadyStart();
          break;
        case STATES.DRAGGING:
          this.draggingStart();
          break;
        case STATES.SELECTED:
          this.selectedStart(options);
          break;
        case STATES.RESIZING:
          this.resizingStart();
          break;
      }
    }

    /** Selection region in document scroll coordinates. */
    get documentRegion() {
      let { left, top, right, bottom } = this.selectionRegion.dimensions;
      let { scrollMinX, scrollMinY } = this.windowDimensions;
      return {
        left: left + scrollMinX,
        top: top + scrollMinY,
        right: right + scrollMinX,
        bottom: bottom + scrollMinY,
      };
    }

    copySelectedRegion() {
      this.controller.copyRegion(this.documentRegion);
    }

    downloadSelectedRegion() {
      this.controller.downloadRegion(this.documentRegion);
    }

    /**
     * Hide hover element, selection and buttons containers.
     * Show the preview container and the panel.
     * This is the initial state of the overlay.
     */
    crosshairsStart() {
      this.hideHoverElementContainer();
      this.hideSelectionContainer();
      this.hideButtonsContainer();
      this.showPreviewContainer();
      this.controller.showPanel();
      this.#previousDimensions = null;
      this.#cachedEle = null;
      this.hoverElementRegion.resetDimensions();
    }

    /** Hide the panel because we have started dragging. */
    draggingReadyStart() {
      this.controller.hidePanel();
    }

    draggingStart() {
      this.hidePreviewContainer();
      this.hideButtonsContainer();
      this.hideHoverElementContainer();
      this.drawSelectionContainer();
    }

    selectedStart(options = {}) {
      this.selectionRegion.sortCoords();
      this.hidePreviewContainer();
      this.hideHoverElementContainer();
      this.drawSelectionContainer();
      this.drawButtonsContainer();

      if (!options.doNotMoveFocus) {
        this.setFocusToActionButton();
      }
    }

    resizingStart() {
      this.hideButtonsContainer();
      let { width, height } = this.selectionRegion.dimensions;
      this.#previousDimensions = { width, height };
    }

    crosshairsDragStart(pageX, pageY) {
      this.selectionRegion.dimensions = {
        left: pageX,
        top: pageY,
        right: pageX,
        bottom: pageY,
      };
      this.#setState(STATES.DRAGGING_READY);
    }

    /**
     * If the background is clicked we set the state to crosshairs
     * otherwise set the state to resizing
     */
    selectedDragStart(pageX, pageY, targetId) {
      if (targetId === this.screenshotsContainer.id) {
        this.#setState(STATES.CROSSHAIRS);
        return;
      }
      this.#moverId = targetId;
      this.#lastPageX = pageX;
      this.#lastPageY = pageY;
      this.#setState(STATES.RESIZING);
    }

    crosshairsMove(clientX, clientY) {
      this.#lastClientX = clientX;
      this.#lastClientY = clientY;
      this.drawPreviewEyes(clientX, clientY);
      this.handleElementHover(clientX, clientY);
    }

    /**
     * Set the selection region dimensions and if the region is at least 40
     * pixels diagnally in distance, set the state to dragging.
     */
    draggingReadyDrag(pageX, pageY) {
      this.selectionRegion.dimensions = {
        right: pageX,
        bottom: pageY,
      };
      if (this.selectionRegion.distance > 40) {
        this.#setState(STATES.DRAGGING);
      }
    }

    draggingDrag(pageX, pageY) {
      this.scrollIfByEdge(pageX, pageY);
      this.selectionRegion.dimensions = {
        right: pageX,
        bottom: pageY,
      };
      this.drawSelectionContainer();
    }

    resizingDrag(pageX, pageY) {
      this.scrollIfByEdge(pageX, pageY);
      switch (this.#moverId) {
        case "mover-topLeft":
          this.selectionRegion.dimensions = { left: pageX, top: pageY };
          break;
        case "mover-top":
          this.selectionRegion.dimensions = { top: pageY };
          break;
        case "mover-topRight":
          this.selectionRegion.dimensions = { top: pageY, right: pageX };
          break;
        case "mover-right":
          this.selectionRegion.dimensions = { right: pageX };
          break;
        case "mover-bottomRight":
          this.selectionRegion.dimensions = { right: pageX, bottom: pageY };
          break;
        case "mover-bottom":
          this.selectionRegion.dimensions = { bottom: pageY };
          break;
        case "mover-bottomLeft":
          this.selectionRegion.dimensions = { left: pageX, bottom: pageY };
          break;
        case "mover-left":
          this.selectionRegion.dimensions = { left: pageX };
          break;
        case "highlight": {
          let diffX = this.#lastPageX - pageX;
          let diffY = this.#lastPageY - pageY;

          let newLeft;
          let newRight;
          let newTop;
          let newBottom;

          let {
            left: boxLeft,
            top: boxTop,
            right: boxRight,
            bottom: boxBottom,
            width: boxWidth,
            height: boxHeight,
          } = this.selectionRegion.dimensions;
          let { scrollWidth, scrollHeight } = this.windowDimensions.dimensions;

          // wait until all 4 if elses have completed before setting box dimensions
          if (boxWidth <= this.#previousDimensions.width && boxLeft === 0) {
            newLeft = boxRight - this.#previousDimensions.width;
          } else {
            newLeft = boxLeft;
          }

          if (boxWidth <= this.#previousDimensions.width && boxRight === scrollWidth) {
            newRight = boxLeft + this.#previousDimensions.width;
          } else {
            newRight = boxRight;
          }

          if (boxHeight <= this.#previousDimensions.height && boxTop === 0) {
            newTop = boxBottom - this.#previousDimensions.height;
          } else {
            newTop = boxTop;
          }

          if (boxHeight <= this.#previousDimensions.height && boxBottom === scrollHeight) {
            newBottom = boxTop + this.#previousDimensions.height;
          } else {
            newBottom = boxBottom;
          }

          this.selectionRegion.dimensions = {
            left: newLeft - diffX,
            top: newTop - diffY,
            right: newRight - diffX,
            bottom: newBottom - diffY,
          };

          this.#lastPageX = pageX;
          this.#lastPageY = pageY;
          break;
        }
      }
      this.drawSelectionContainer();
    }

    /**
     * If there is a valid element region, select it.
     * Otherwise set the state to crosshairs.
     */
    draggingReadyDragEnd(options = {}) {
      if (this.hoverElementRegion.isRegionValid) {
        this.selectionRegion.dimensions = this.hoverElementRegion.dimensions;
        this.#setState(STATES.SELECTED, options);
      } else {
        this.#setState(STATES.CROSSHAIRS);
      }
    }

    draggingDragEnd(pageX, pageY) {
      this.selectionRegion.dimensions = {
        right: pageX,
        bottom: pageY,
      };
      this.#setState(STATES.SELECTED);
    }

    resizingDragEnd(pageX, pageY) {
      this.resizingDrag(pageX, pageY);
      this.#setState(STATES.SELECTED);
    }

    /** Draw the preview eyes pointer towards the mouse. */
    drawPreviewEyes(clientX, clientY) {
      let { clientWidth, clientHeight } = this.windowDimensions.dimensions;
      const xpos = Math.floor((10 * (clientX - clientWidth / 2)) / clientWidth);
      const ypos = Math.floor((10 * (clientY - clientHeight / 2)) / clientHeight);
      const move = `translate(${xpos}px, ${ypos}px)`;
      this.leftEye.style.transform = move;
      this.rightEye.style.transform = move;
    }

    showPreviewContainer() {
      this.previewContainer.hidden = false;
    }

    hidePreviewContainer() {
      this.previewContainer.hidden = true;
    }

    updatePreviewContainer() {
      let { clientWidth, clientHeight } = this.windowDimensions.dimensions;
      this.previewContainer.style.width = `${clientWidth}px`;
      this.previewContainer.style.height = `${clientHeight}px`;
    }

    updateScreenshotsOverlayContainer() {
      let { scrollWidth, scrollHeight, scrollMinX } = this.windowDimensions.dimensions;
      this.screenshotsContainer.style.cssText = `left:${scrollMinX}px;width:${scrollWidth}px;height:${scrollHeight}px;`;
    }

    drawHoverElementRegion() {
      this.showHoverElementContainer();
      let { top, left, width, height } = this.hoverElementRegion.dimensions;
      this.hoverElementContainer.style.cssText = `top:${top}px;left:${left}px;width:${width}px;height:${height}px;`;
    }

    showHoverElementContainer() {
      this.hoverElementContainer.hidden = false;
    }

    hideHoverElementContainer() {
      this.hoverElementContainer.hidden = true;
    }

    /**
     * Draw each background element and the highlight element base on the
     * selection region.
     */
    drawSelectionContainer() {
      this.showSelectionContainer();

      let { top, left, right, bottom, width, height } = this.selectionRegion.dimensions;

      this.highlightEl.style.cssText = `top:${top}px;left:${left}px;width:${width}px;height:${height}px;`;

      this.leftBackgroundEl.style.cssText = `top:${top}px;width:${left}px;height:${height}px;`;
      this.topBackgroundEl.style.height = `${top}px`;
      this.rightBackgroundEl.style.cssText = `top:${top}px;left:${right}px;width:calc(100% - ${right}px);height:${height}px;`;
      this.bottomBackgroundEl.style.cssText = `top:${bottom}px;height:calc(100% - ${bottom}px);`;

      this.updateSelectionSizeText();
    }

    /**
     * Update the size of the selected region. Use the zoom to correctly display
     * the region dimensions.
     */
    updateSelectionSizeText() {
      let { width, height } = this.selectionRegion.dimensions;
      let zoom = Math.round(this.controller.zoom * 100) / 100;
      this.selectionSize.textContent = L10N.selectionSize(
        Math.floor(width * zoom),
        Math.floor(height * zoom)
      );
    }

    showSelectionContainer() {
      this.selectionContainer.hidden = false;
    }

    hideSelectionContainer() {
      this.selectionContainer.hidden = true;
    }

    /**
     * Draw the buttons container in the bottom right corner of the selection
     * container if possible.
     */
    drawButtonsContainer() {
      this.showButtonsContainer();

      let { top: boxTop, right: boxRight, bottom: boxBottom } =
        this.selectionRegion.dimensions;

      let { clientWidth, clientHeight, scrollX, scrollY, scrollWidth } =
        this.windowDimensions.dimensions;

      if (!this.windowDimensions.isInViewport(this.selectionRegion.dimensions)) {
        // The box is entirely offscreen so need to draw the buttons
        return;
      }

      let top = boxBottom;

      if (scrollY + clientHeight - boxBottom < 70) {
        if (boxBottom < scrollY + clientHeight) {
          top = boxBottom - 60;
        } else if (scrollY + clientHeight - boxTop < 70) {
          top = boxTop - 60;
        } else {
          top = scrollY + clientHeight - 60;
        }
      }

      if (!this.buttonsContainerRect) {
        this.buttonsContainerRect = this.buttonsContainer.getBoundingClientRect();
      }

      let viewportLeft = scrollX;
      let viewportRight = scrollX + clientWidth;

      let left = Math.max(
        Math.min(viewportRight, boxRight),
        viewportLeft + Math.ceil(this.buttonsContainerRect.width)
      );
      let right = scrollWidth - left;

      this.buttonsContainer.style.right = `${right}px`;
      this.buttonsContainer.style.left = "";
      this.buttonsContainer.style.top = `${top}px`;
    }

    showButtonsContainer() {
      this.buttonsContainer.hidden = false;
    }

    hideButtonsContainer() {
      this.buttonsContainer.hidden = true;
    }

    /**
     * Set the pointer events to none on the screenshots elements so
     * elementFromPoint can find the real element at the given point.
     */
    setPointerEventsNone() {
      this.screenshotsContainer.style.pointerEvents = "none";
    }

    resetPointerEvents() {
      this.screenshotsContainer.style.pointerEvents = "";
    }

    /**
     * Try to find a reasonable element for a given point.
     * If a reasonable element is found, draw the hover element container for
     * that element region.
     */
    handleElementHover(clientX, clientY) {
      this.setPointerEventsNone();
      let { ele, rect } = getElementFromPoint(clientX, clientY, this.document);
      this.resetPointerEvents();

      if (this.#cachedEle && !isFrameElement(this.#cachedEle) && this.#cachedEle === ele) {
        // Still hovering over the same element
        return;
      }
      this.#cachedEle = ele;

      if (ele === this.controller.host) {
        // Over the "Save visible / Save full page" panel.
        rect = null;
        ele = null;
      } else if (!rect) {
        // this means we found an element that wasn't an iframe
        rect = getBestRectForElement(ele, this.document);
      }

      if (rect) {
        this.hoverElementRegion.setDimensionsFromDOMRect(rect);
        this.drawHoverElementRegion();
      } else {
        this.hoverElementRegion.resetDimensions();
        this.hideHoverElementContainer();
      }
    }

    /** Scroll the viewport if near one or both of the edges. */
    scrollIfByEdge(pageX, pageY) {
      let { scrollX, scrollY, clientWidth, clientHeight } = this.windowDimensions.dimensions;

      if (pageY - scrollY < SCROLL_BY_EDGE) {
        // Scroll up
        this.scrollWindow(0, -(SCROLL_BY_EDGE - (pageY - scrollY)));
      } else if (scrollY + clientHeight - pageY < SCROLL_BY_EDGE) {
        // Scroll down
        this.scrollWindow(0, SCROLL_BY_EDGE - (scrollY + clientHeight - pageY));
      }

      if (pageX - scrollX <= SCROLL_BY_EDGE) {
        // Scroll left
        this.scrollWindow(-(SCROLL_BY_EDGE - (pageX - scrollX)), 0);
      } else if (scrollX + clientWidth - pageX <= SCROLL_BY_EDGE) {
        // Scroll right
        this.scrollWindow(SCROLL_BY_EDGE - (scrollX + clientWidth - pageX), 0);
      }
    }

    scrollWindow(x, y) {
      this.window.scrollBy({ left: x, top: y, behavior: "instant" });
      this.updateScreenshotsOverlayDimensions("scroll");
    }

    /**
     * The page was resized or scrolled. We need to update the screenshots
     * container size so we don't draw outside the page bounds.
     */
    updateScreenshotsOverlayDimensions(eventType) {
      this.updateWindowDimensions();

      if (this.#state === STATES.CROSSHAIRS) {
        if (eventType === "resize") {
          this.hideHoverElementContainer();
          this.#cachedEle = null;
        } else if (eventType === "scroll") {
          if (this.#lastClientX != null && this.#lastClientY != null) {
            this.#cachedEle = null;
            this.handleElementHover(this.#lastClientX, this.#lastClientY);
          }
        }
      } else if (this.#state === STATES.SELECTED) {
        this.selectionRegion.shift();
        this.drawSelectionContainer();
        this.drawButtonsContainer();
        this.updateSelectionSizeText();
      }
    }

    /** Returns the window's dimensions for the current window. */
    getDimensionsFromWindow() {
      return getPageDimensions();
    }

    /**
     * We have to be careful not to draw the overlay larger than the document
     * because the overlay is absolutely positioned within the document. To
     * mitigate this, temporarily make the overlay fixed 100% while measuring.
     */
    updateWindowDimensions() {
      this.screenshotsContainer.toggleAttribute("resizing", true);
      let dims = this.getDimensionsFromWindow();
      this.screenshotsContainer.toggleAttribute("resizing", false);

      this.windowDimensions.dimensions = {
        ...dims,
        devicePixelRatio: this.window.devicePixelRatio,
      };

      this.updatePreviewContainer();
      this.updateScreenshotsOverlayContainer();

      setMaxDetectHeight(Math.max(dims.clientHeight + 100, 700));
      setMaxDetectWidth(Math.max(dims.clientWidth + 100, 1000));
    }
  }

  /** Page/viewport dimensions, the Chromium equivalent of Firefox's scrollMin/Max. */
  function getPageDimensions() {
    let scroller = document.scrollingElement || document.documentElement;
    let clientWidth = scroller.clientWidth || window.innerWidth;
    let clientHeight = scroller.clientHeight || window.innerHeight;
    // In quirks mode the body is the scrolling element and its client size is
    // the viewport; in standards mode it's <html>.
    let scrollWidth = Math.max(scroller.scrollWidth, clientWidth);
    let scrollHeight = Math.max(scroller.scrollHeight, clientHeight);
    let rtl = getComputedStyle(document.documentElement).direction === "rtl";
    let scrollMinX = rtl ? Math.min(0, clientWidth - scrollWidth) : 0;
    let scrollMinY = 0;
    return {
      clientWidth,
      clientHeight,
      scrollWidth,
      scrollHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      scrollMinX,
      scrollMinY,
      scrollMaxX: scrollMinX + scrollWidth - clientWidth,
      scrollMaxY: scrollHeight - clientHeight,
    };
  }

  /* ------------------------------------------------------------------ */
  /* Filename: foxshot-2026-11-13-183449.png (local time)               */
  /* ------------------------------------------------------------------ */

  function getFilename() {
    const date = new Date();
    const local = new Date(
      date.getTime() - date.getTimezoneOffset() * 60 * 1000
    ).toISOString();
    const day = local.substring(0, 10);
    const time = local.substring(11, 19).replace(/:/g, "");
    return `foxshot-${day}-${time}.png`;
  }

  /* ------------------------------------------------------------------ */
  /* Capture (replaces ScreenshotsUtils.createCanvas / drawSnapshot)    */
  /* ------------------------------------------------------------------ */

  // Firefox's limits (ScreenshotsUtils.sys.mjs), which also keep us inside
  // Chromium's canvas limits.
  const MAX_CAPTURE_DIMENSION = 32766;
  const MAX_CAPTURE_AREA = 124925329;

  const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));
  const settle = async () => {
    await nextFrame();
    await nextFrame();
    await new Promise(r => setTimeout(r, 20));
  };

  async function sendMessage(msg) {
    let resp = await chrome.runtime.sendMessage(msg);
    if (resp?.error) {
      throw new Error(resp.error);
    }
    return resp;
  }

  async function captureViewport() {
    let { dataUrl } = await sendMessage({ type: "capture" });
    let base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
    let bin = atob(base64);
    let bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return createImageBitmap(new Blob([bytes], { type: "image/png" }));
  }

  /**
   * While stitching, sticky elements are pinned in place (so they don't
   * repeat in every tile) and fixed elements are hidden after the first tile.
   */
  class StitchPageState {
    #changed = [];
    #fixed = [];

    #set(el, prop, value) {
      this.#changed.push([el, prop, el.style.getPropertyValue(prop), el.style.getPropertyPriority(prop)]);
      el.style.setProperty(prop, value, "important");
    }

    prepare() {
      let html = document.documentElement;
      this.#set(html, "scroll-behavior", "auto");
      if (document.body) {
        this.#set(document.body, "scroll-behavior", "auto");
      }
      let walker = document.createTreeWalker(document.body || html, NodeFilter.SHOW_ELEMENT);
      for (let el = walker.currentNode; el; el = walker.nextNode()) {
        if (el.localName === "foxshot-root") {
          continue;
        }
        let pos = getComputedStyle(el).position;
        if (pos === "sticky" || pos === "-webkit-sticky") {
          this.#set(el, "position", "static");
        } else if (pos === "fixed") {
          this.#fixed.push(el);
        }
      }
    }

    hideFixed() {
      for (let el of this.#fixed) {
        this.#set(el, "visibility", "hidden");
      }
      this.#fixed = [];
    }

    restore() {
      for (let [el, prop, value, priority] of this.#changed.reverse()) {
        if (value) {
          el.style.setProperty(prop, value, priority);
        } else {
          el.style.removeProperty(prop);
        }
      }
      this.#changed = [];
    }
  }

  /**
   * Capture a region given in document scroll coordinates.
   *
   * @returns {Promise<{blob: Blob, bitmap: ImageBitmap, cropped: boolean}>}
   */
  async function captureRegion(region) {
    let left = Math.round(region.left);
    let top = Math.round(region.top);
    let right = Math.round(region.right);
    let bottom = Math.round(region.bottom);
    let width = Math.max(1, right - left);
    let height = Math.max(1, bottom - top);

    let { clientWidth: vw, clientHeight: vh } = getPageDimensions();
    let startX = window.scrollX;
    let startY = window.scrollY;

    let inViewport =
      left >= startX && top >= startY && right <= startX + vw && bottom <= startY + vh;

    let canvas = null;
    let ctx = null;
    let scale = 0;
    let cropped = false;

    let ensureCanvas = img => {
      if (canvas) {
        return;
      }
      scale = img.width / window.innerWidth;
      let w = width * scale;
      let h = height * scale;
      // cropScreenshotRectIfNeeded
      if (w > MAX_CAPTURE_DIMENSION) {
        w = MAX_CAPTURE_DIMENSION;
        cropped = true;
      }
      if (h > MAX_CAPTURE_DIMENSION) {
        h = MAX_CAPTURE_DIMENSION;
        cropped = true;
      }
      if (w * h > MAX_CAPTURE_AREA) {
        h = Math.floor(MAX_CAPTURE_AREA / w);
        cropped = true;
      }
      canvas = new OffscreenCanvas(Math.round(w), Math.round(h));
      ctx = canvas.getContext("2d");
      // Same background drawSnapshot uses for transparent pages.
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    let drawTile = (img, tileLeft, tileTop, tileRight, tileBottom, sx, sy) => {
      let srcX = Math.round((tileLeft - sx) * scale);
      let srcY = Math.round((tileTop - sy) * scale);
      let dstX = Math.round((tileLeft - left) * scale);
      let dstY = Math.round((tileTop - top) * scale);
      let dstW = Math.round((tileRight - left) * scale) - dstX;
      let dstH = Math.round((tileBottom - top) * scale) - dstY;
      ctx.drawImage(img, srcX, srcY, dstW, dstH, dstX, dstY, dstW, dstH);
    };

    await settle();

    if (inViewport) {
      let img = await captureViewport();
      ensureCanvas(img);
      drawTile(img, left, top, right, bottom, startX, startY);
      img.close();
    } else {
      let pageState = new StitchPageState();
      pageState.prepare();
      try {
        let first = true;
        for (let tileTop = top; tileTop < bottom; tileTop += vh) {
          for (let tileLeft = left; tileLeft < right; tileLeft += vw) {
            window.scrollTo({ left: tileLeft, top: tileTop, behavior: "instant" });
            if (!first) {
              pageState.hideFixed();
            }
            await settle();
            let img = await captureViewport();
            ensureCanvas(img);
            drawTile(
              img,
              tileLeft,
              tileTop,
              Math.min(tileLeft + vw, right),
              Math.min(tileTop + vh, bottom),
              window.scrollX,
              window.scrollY
            );
            img.close();
            first = false;
            if ((tileTop - top) * scale >= canvas.height) {
              break;
            }
          }
          if ((tileTop + vh - top) * scale >= canvas.height) {
            break;
          }
        }
      } finally {
        pageState.restore();
        window.scrollTo({ left: startX, top: startY, behavior: "instant" });
      }
    }

    let blob = await canvas.convertToBlob({ type: "image/png" });
    let bitmap = canvas.transferToImageBitmap();
    return { blob, bitmap, cropped };
  }

  /* ------------------------------------------------------------------ */
  /* Controller (ScreenshotsUtils.sys.mjs)                              */
  /* ------------------------------------------------------------------ */

  const BLOCKED_EVENTS = [
    "pointerdown",
    "pointermove",
    "pointerup",
    "pointercancel",
    "mousedown",
    "mousemove",
    "mouseup",
    "mouseover",
    "mouseout",
    "click",
    "dblclick",
    "auxclick",
    "contextmenu",
    "keydown",
    "keyup",
    "keypress",
    "touchstart",
    "touchmove",
    "touchend",
    "selectstart",
    "dragstart",
    "wheel",
  ];

  const HANDLED_KEYS = new Set([
    "Escape",
    "Tab",
    "Enter",
    " ",
    "ArrowLeft",
    "ArrowUp",
    "ArrowRight",
    "ArrowDown",
  ]);

  const HINT_DURATION = 1500;

  class Foxshot {
    active = false;
    busy = false;
    zoom = 1;
    lastSavedMethod = "download";
    lastScreenshotMethod = "visible";
    host = null;
    root = null;
    overlay = null;
    panel = null;
    dialog = null;
    previewBlob = null;

    constructor() {
      this.prefsLoaded = chrome.storage.local
        .get(["lastSavedMethod", "lastScreenshotMethod"])
        .then(prefs => Object.assign(this, prefs))
        .catch(() => {});
    }

    toggle() {
      if (this.active) {
        this.cancel();
      } else {
        this.start();
      }
    }

    async start() {
      if (this.active) {
        return;
      }
      this.active = true;
      this.busy = false;

      sendMessage({ type: "getZoom" })
        .then(({ zoom }) => {
          this.zoom = zoom;
          if (this.overlay?.state && this.overlay.state !== STATES.CROSSHAIRS) {
            this.overlay.updateSelectionSizeText();
          }
        })
        .catch(() => {});

      this.createHost();
      this.createPanel();
      this.overlay = new ScreenshotsOverlay(this, this.root);
      this.overlay.initialize();
      this.addListeners();

      await this.prefsLoaded;
      if (this.overlay?.state === STATES.CROSSHAIRS) {
        this.focusPanelButton(this.lastScreenshotMethod);
      }
    }

    /** Tear everything down (ScreenshotsUtils.exit). */
    exit() {
      this.removeListeners();
      this.host?.remove();
      this.host = this.root = this.overlay = this.panel = this.dialog = null;
      this.previewBlob = null;
      this.active = false;
      this.busy = false;
    }

    cancel() {
      this.exit();
    }

    createHost() {
      let host = document.createElement("foxshot-root");
      let style = {
        all: "initial",
        display: "block",
        position: "absolute",
        top: "0",
        left: "0",
        width: "0",
        height: "0",
        margin: "0",
        padding: "0",
        border: "none",
        overflow: "visible",
        "z-index": "2147483647",
        "pointer-events": "none",
        visibility: "visible",
        opacity: "1",
        transform: "none",
        filter: "none",
      };
      for (let [prop, value] of Object.entries(style)) {
        host.style.setProperty(prop, value, "important");
      }
      let root = host.attachShadow({ mode: "closed" });
      let sheet = new CSSStyleSheet();
      sheet.replaceSync(globalThis.__foxshotCSS);
      root.adoptedStyleSheets = [sheet];
      document.documentElement.appendChild(host);
      this.host = host;
      this.root = root;
    }

    setHostVisible(visible) {
      this.host?.style.setProperty("visibility", visible ? "visible" : "hidden", "important");
    }

    /* ----- "Save visible / Save full page" panel (screenshots-buttons.js) ----- */

    createPanel() {
      let panel = document.createElement("div");
      panel.id = "screenshots-panel";
      panel.hidden = true;
      panel.innerHTML = `
        <div class="button-group">
          <button id="visible-page" class="screenshot-button footer-button">${MENU_VISIBLE_SVG}${L10N.saveVisible}</button>
          <button id="full-page" class="screenshot-button footer-button primary">${MENU_FULLPAGE_SVG}${L10N.saveFullPage}</button>
        </div>`;
      this.root.appendChild(panel);
      this.panel = panel;
    }

    get panelButtons() {
      if (!this.panel || this.panel.hidden) {
        return [];
      }
      return [...this.panel.querySelectorAll("button")];
    }

    showPanel() {
      if (this.panel) {
        this.panel.hidden = false;
      }
    }

    hidePanel() {
      if (this.panel) {
        this.panel.hidden = true;
      }
    }

    focusPanelButton(buttonToFocus) {
      if (!this.panel) {
        return;
      }
      let id = buttonToFocus === "fullpage" ? "full-page" : "visible-page";
      focusVisible(this.root.getElementById(id), { preventScroll: true });
    }

    onOverlaySelection(hasSelection) {
      if (hasSelection) {
        this.hidePanel();
      }
    }

    handlePanelClick(button) {
      switch (button?.id) {
        case "visible-page":
          this.takeScreenshot("Visible");
          break;
        case "full-page":
          this.takeScreenshot("FullPage");
          break;
      }
    }

    /* ----- focus ----- */

    cycleFocus(backward) {
      let list = this.dialog ? this.dialogButtons : this.overlay?.focusCycle || [];
      list = list.filter(Boolean);
      if (!list.length) {
        return;
      }
      let idx = list.indexOf(this.root.activeElement);
      let next;
      if (idx === -1) {
        next = backward ? list[list.length - 1] : list[0];
      } else {
        next = list[(idx + (backward ? -1 : 1) + list.length) % list.length];
      }
      focusVisible(next);
    }

    /* ----- events ----- */

    addListeners() {
      this.onEvent = e => this.handleEvent(e);
      this.onScrollOrResize = e => {
        if (!this.busy && this.overlay?.initialized && !this.dialog) {
          this.overlay.updateScreenshotsOverlayDimensions(e.type);
        }
      };
      for (let type of BLOCKED_EVENTS) {
        window.addEventListener(type, this.onEvent, { capture: true, passive: false });
      }
      window.addEventListener("scroll", this.onScrollOrResize, { capture: true, passive: true });
      window.addEventListener("resize", this.onScrollOrResize, { passive: true });
    }

    removeListeners() {
      if (!this.onEvent) {
        return;
      }
      for (let type of BLOCKED_EVENTS) {
        window.removeEventListener(type, this.onEvent, { capture: true });
      }
      window.removeEventListener("scroll", this.onScrollOrResize, { capture: true });
      window.removeEventListener("resize", this.onScrollOrResize);
      this.onEvent = this.onScrollOrResize = null;
    }

    resolveTarget(e) {
      if (e.type.startsWith("key")) {
        return this.root.activeElement;
      }
      let point = e.changedTouches?.[0] ?? e;
      if (point.clientX == null) {
        return null;
      }
      return this.root.elementFromPoint(point.clientX, point.clientY);
    }

    handleEvent(e) {
      if (!this.active || !this.root) {
        return;
      }

      // The page doesn't get to see any input while Foxshot is up.
      e.stopImmediatePropagation();

      if (e.type === "wheel") {
        // Let the page scroll under the overlay, but not under the dialog
        // (except the preview image itself).
        if (this.dialog && !this.resolveTarget(e)?.closest("#preview-image-container")) {
          e.preventDefault();
        }
        return;
      }
      if (e.type === "contextmenu") {
        return;
      }
      if (["mousedown", "selectstart", "dragstart", "auxclick", "dblclick"].includes(e.type)) {
        e.preventDefault();
        return;
      }
      if (e.type.startsWith("mouse") || e.type === "keypress") {
        return;
      }

      if (!e.isTrusted) {
        return;
      }

      let target = this.resolveTarget(e);

      if (e.type === "keydown") {
        let accel = IS_MAC ? e.metaKey : e.ctrlKey;
        let key = e.key.toLowerCase();
        if (
          HANDLED_KEYS.has(e.key) ||
          (accel && (key === COPY_KEY.toLowerCase() || key === DOWNLOAD_KEY.toLowerCase()))
        ) {
          e.preventDefault();
        }
      } else if (e.cancelable && e.type !== "pointermove") {
        e.preventDefault();
      }

      if (this.busy) {
        return;
      }

      if (this.dialog) {
        this.handleDialogEvent(e, target);
        return;
      }

      // The panel lives outside the overlay container.
      let panelButton = target?.closest?.("#screenshots-panel button");
      if (panelButton || target?.closest?.("#screenshots-panel")) {
        if (e.type === "click" && panelButton) {
          this.handlePanelClick(panelButton);
        } else if (
          e.type === "keydown" &&
          (e.key === "Enter" || e.key === " ") &&
          panelButton
        ) {
          this.handlePanelClick(panelButton);
        } else if (e.type === "keydown") {
          if (e.key === "Tab") {
            this.cycleFocus(e.shiftKey);
          } else {
            this.overlay.handleEvent(e, target);
          }
        } else if (e.type === "pointermove") {
          this.overlay.handleEvent(e, target);
        }
        return;
      }

      this.overlay?.handleEvent(e, target);
    }

    /* ----- actions ----- */

    /**
     * Copy a region. Must be called synchronously from a user gesture: the
     * clipboard write starts immediately with a promised blob.
     */
    copyRegion(region) {
      if (this.busy) {
        return;
      }
      this.busy = true;
      this.setHostVisible(false);
      let capture = captureRegion(region);
      let written = this.writeClipboard(capture.then(c => c.blob));
      Promise.all([capture, written])
        .then(([{ cropped }, ok]) => {
          this.exit();
          if (ok) {
            this.savedMethod("copy");
            showHint(cropped ? L10N.tooLargeTitle : L10N.copied, !cropped);
          }
        })
        .catch(e => {
          console.error("Foxshot: copy failed", e);
          this.exit();
        });
    }

    /**
     * Download a region, and copy it to the clipboard too. Like copyRegion,
     * must be called synchronously from a user gesture.
     */
    downloadRegion(region) {
      if (this.busy) {
        return;
      }
      this.busy = true;
      this.setHostVisible(false);
      let capture = captureRegion(region);
      let copied = this.writeClipboard(capture.then(c => c.blob));
      capture
        .then(async ({ blob, cropped }) => {
          await this.saveBlob(blob);
          this.savedMethod("download");
          let ok = await copied;
          this.exit();
          if (cropped) {
            showHint(L10N.tooLargeTitle, false);
          } else if (ok) {
            showHint(L10N.copied, true);
          }
        })
        .catch(e => {
          console.error("Foxshot: download failed", e);
          this.exit();
        });
    }

    writeClipboard(blobPromise) {
      try {
        return navigator.clipboard
          .write([new ClipboardItem({ "image/png": blobPromise })])
          .then(
            () => true,
            e => {
              console.error("Foxshot: couldn't write to the clipboard", e);
              return false;
            }
          );
      } catch (e) {
        console.error("Foxshot: couldn't write to the clipboard", e);
        return Promise.resolve(false);
      }
    }

    async saveBlob(blob) {
      let filename = getFilename();
      let fallbackFilename = filename;
      let url = await new Promise((resolve, reject) => {
        let reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      try {
        await sendMessage({ type: "download", url, filename, fallbackFilename });
      } catch (e) {
        // Too big for a message, or the downloads API refused: fall back to
        // a plain <a download>.
        let a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 60000);
      }
    }

    savedMethod(method) {
      this.lastSavedMethod = method;
      chrome.storage.local.set({ lastSavedMethod: method }).catch(() => {});
    }

    /** "Save visible" / "Save full page" (ScreenshotsUtils.takeScreenshot). */
    async takeScreenshot(type) {
      if (this.busy) {
        return;
      }
      this.busy = true;
      this.lastScreenshotMethod = type === "FullPage" ? "fullpage" : "visible";
      chrome.storage.local
        .set({ lastScreenshotMethod: this.lastScreenshotMethod })
        .catch(() => {});

      this.hidePanel();
      this.overlay.tearDown();
      this.setHostVisible(false);

      let dims = getPageDimensions();
      let rect =
        type === "FullPage"
          ? {
              left: dims.scrollMinX,
              top: dims.scrollMinY,
              right: dims.scrollMinX + dims.scrollWidth,
              bottom: dims.scrollMinY + dims.scrollHeight,
            }
          : {
              left: window.scrollX,
              top: window.scrollY,
              right: window.scrollX + dims.clientWidth,
              bottom: window.scrollY + dims.clientHeight,
            };

      try {
        let { blob, bitmap, cropped } = await captureRegion(rect);
        if (!this.active) {
          return;
        }
        this.openPreviewDialog(blob, bitmap);
        if (cropped) {
          showHint(L10N.tooLargeTitle, false);
        }
      } catch (e) {
        console.error("Foxshot: screenshot failed", e);
        this.exit();
        return;
      }
      this.setHostVisible(true);
      this.busy = false;
    }

    /* ----- preview dialog (screenshots-preview.mjs) ----- */

    openPreviewDialog(blob, bitmap) {
      this.previewBlob = blob;
      let dialog = document.createElement("div");
      dialog.id = "preview-dialog";
      dialog.innerHTML = `
        <div class="dialog-box" role="dialog" aria-modal="true">
          <div class="image-view">
            <div class="preview-buttons">
              <button id="preview-retry" class="icon-button" title="${L10N.retryTitle}" aria-label="${L10N.retryTitle}">${icon("reload")}</button>
              <button id="preview-cancel" class="icon-button" title="${L10N.cancelTitle}" aria-label="${L10N.cancel}">${icon("close")}</button>
              <button id="preview-copy" title="${L10N.copyTitle}" aria-label="${L10N.copy}">${icon("copy")}<span>${L10N.copy}</span></button>
              <button id="preview-download" class="primary" title="${L10N.downloadTitle}" aria-label="${L10N.download}">${icon("download")}<span>${L10N.download}</span></button>
            </div>
            <div id="preview-image-container">
              <canvas id="preview-image"></canvas>
            </div>
          </div>
        </div>`;
      // A canvas instead of <img src=blob:> so page CSPs can't block it.
      let canvas = dialog.querySelector("#preview-image");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext("bitmaprenderer").transferFromImageBitmap(bitmap);
      this.root.appendChild(dialog);
      this.dialog = dialog;

      let focusId = this.lastSavedMethod === "copy" ? "preview-copy" : "preview-download";
      focusVisible(this.root.getElementById(focusId));
    }

    get dialogButtons() {
      return this.dialog ? [...this.dialog.querySelectorAll(".preview-buttons > button")] : [];
    }

    handleDialogEvent(e, target) {
      let button = target?.closest?.(".preview-buttons > button");
      if (e.type === "click" || e.type === "touchend") {
        if (button && !button.disabled) {
          this.handleDialogAction(button.id);
        }
        return;
      }
      if (e.type !== "keydown") {
        return;
      }
      let accel = IS_MAC ? e.metaKey : e.ctrlKey;
      switch (e.key) {
        case "Escape":
          this.handleDialogAction("preview-cancel");
          break;
        case "Tab":
          this.cycleFocus(e.shiftKey);
          break;
        case "Enter":
        case " ":
          if (button) {
            this.handleDialogAction(button.id);
          }
          break;
        default:
          if (accel && e.key.toLowerCase() === COPY_KEY.toLowerCase()) {
            this.handleDialogAction("preview-copy");
          } else if (accel && e.key.toLowerCase() === DOWNLOAD_KEY.toLowerCase()) {
            this.handleDialogAction("preview-download");
          }
      }
    }

    disableDialogButtons() {
      this.dialogButtons.forEach(b => (b.disabled = true));
    }

    handleDialogAction(id) {
      switch (id) {
        case "preview-retry":
          this.exit();
          this.start();
          break;
        case "preview-cancel":
          this.exit();
          break;
        case "preview-copy": {
          this.disableDialogButtons();
          this.busy = true;
          this.writeClipboard(Promise.resolve(this.previewBlob)).then(ok => {
            this.exit();
            if (ok) {
              this.savedMethod("copy");
              showHint(L10N.copied, true);
            }
          });
          break;
        }
        case "preview-download": {
          this.disableDialogButtons();
          this.busy = true;
          let blob = this.previewBlob;
          let copied = this.writeClipboard(Promise.resolve(blob));
          this.saveBlob(blob)
            .then(async () => {
              this.savedMethod("download");
              let ok = await copied;
              this.exit();
              if (ok) {
                showHint(L10N.copied, true);
              }
            })
            .catch(e => {
              console.error("Foxshot: download failed", e);
              this.exit();
            });
          break;
        }
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* ConfirmationHint ("Screenshot copied!")                            */
  /* ------------------------------------------------------------------ */

  let hintHost = null;
  let hintTimer = null;

  function showHint(message, withCheckmark) {
    hintHost?.remove();
    clearTimeout(hintTimer);

    hintHost = document.createElement("foxshot-root");
    for (let [prop, value] of Object.entries({
      all: "initial",
      display: "block",
      position: "fixed",
      top: "0",
      right: "0",
      width: "0",
      height: "0",
      "z-index": "2147483647",
      "pointer-events": "none",
    })) {
      hintHost.style.setProperty(prop, value, "important");
    }
    let root = hintHost.attachShadow({ mode: "closed" });
    let sheet = new CSSStyleSheet();
    sheet.replaceSync(globalThis.__foxshotCSS);
    root.adoptedStyleSheets = [sheet];
    let hint = document.createElement("div");
    hint.id = "confirmation-hint";
    hint.setAttribute("role", "alert");
    hint.innerHTML =
      (withCheckmark
        ? `<div id="confirmation-hint-checkmark-animation-container">${SUCCESS_ANIMATION_SVG}</div>`
        : "") + `<div id="confirmation-hint-message"></div>`;
    hint.querySelector("#confirmation-hint-message").textContent = message;
    root.appendChild(hint);
    document.documentElement.appendChild(hintHost);

    let host = hintHost;
    hintTimer = setTimeout(
      () => {
        hint.classList.add("closing");
        setTimeout(() => host.remove(), 200);
      },
      withCheckmark ? HINT_DURATION : 4000
    );
  }

  /* ------------------------------------------------------------------ */

  const foxshot = new Foxshot();
  globalThis.__foxshot = foxshot;
  foxshot.start();
})();
