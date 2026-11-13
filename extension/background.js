/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const CONTENT_SCRIPTS = ["content/styles.js", "content/foxshot.js"];

// chrome.tabs.captureVisibleTab is limited to 2 calls per second.
const CAPTURE_INTERVAL_MS = 550;
let captureQueue = Promise.resolve();
let lastCaptureTime = 0;

async function toggleScreenshots(tab) {
  if (!tab?.id) {
    return;
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: CONTENT_SCRIPTS,
    });
  } catch (e) {
    // Restricted pages (chrome://, the Web Store, the PDF viewer...) can't
    // be scripted by any extension.
    console.warn("Foxshot can't run on this page:", e.message);
  }
}

chrome.action.onClicked.addListener(toggleScreenshots);

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "foxshot-take-screenshot",
    title: "Take Screenshot",
    contexts: ["page", "frame", "selection", "link", "image", "video", "audio", "editable"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "foxshot-take-screenshot") {
    toggleScreenshots(tab);
  }
});

function captureVisibleTab(windowId) {
  let job = captureQueue.then(async () => {
    let wait = lastCaptureTime + CAPTURE_INTERVAL_MS - Date.now();
    if (wait > 0) {
      await new Promise(r => setTimeout(r, wait));
    }
    try {
      return await chrome.tabs.captureVisibleTab(windowId, { format: "png" });
    } finally {
      lastCaptureTime = Date.now();
    }
  });
  captureQueue = job.catch(() => {});
  return job;
}

async function download(url, filename, fallbackFilename) {
  let opts = { url, saveAs: false, conflictAction: "uniquify" };
  try {
    return await chrome.downloads.download({ ...opts, filename });
  } catch (e) {
    // Chrome rejects some filenames that are fine elsewhere; retry with the
    // plain date/time name.
    return chrome.downloads.download({ ...opts, filename: fallbackFilename });
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  let tab = sender.tab;
  let work;
  switch (msg?.type) {
    case "capture":
      work = captureVisibleTab(tab.windowId).then(dataUrl => ({ dataUrl }));
      break;
    case "download":
      work = download(msg.url, msg.filename, msg.fallbackFilename).then(id => ({ id }));
      break;
    case "getZoom":
      work = chrome.tabs.getZoom(tab.id).then(zoom => ({ zoom }));
      break;
    default:
      return false;
  }
  work.then(sendResponse, e => sendResponse({ error: String(e?.message || e) }));
  return true;
});
