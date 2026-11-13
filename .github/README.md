<p align="center">
  <img src="../branding/foxshot-512.png" width="96" alt="Foxshot logo">
</p>

<h1 align="center">Foxshot</h1>

<p align="center">Firefox's built-in screenshot tool, ported to Chromium browsers.</p>

## Features

- Drag to select a region, or click to pick an element
- **Save visible** and **Save full page**, with a preview before saving
- Every screenshot is copied to the clipboard, and can be downloaded as PNG
- Keyboard: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd> to start, <kbd>Esc</kbd> to cancel, <kbd>Ctrl</kbd>+<kbd>C</kbd> copy, <kbd>Ctrl</kbd>+<kbd>S</kbd> download, arrow keys to adjust

No telemetry, no accounts, no network access.

## Install

Download `foxshot-<version>.crx` from [Releases](../../releases) and drag it onto `chrome://extensions` with Developer mode enabled, or choose **Load unpacked** and select the `extension/` folder.

## Build

```sh
scripts/build.sh   # writes foxshot-<version>.crx
```

## Credits

Foxshot is a port of [Firefox Screenshots](https://github.com/mozilla-firefox/firefox/tree/main/browser/components/screenshots) by Mozilla. The selection overlay, styles, icons and strings are derived from Firefox source code and remain under the [Mozilla Public License 2.0](../extension/LICENSE).

Not affiliated with or endorsed by Mozilla. Firefox is a trademark of the Mozilla Foundation.
