const OFFSCREEN_URL = "offscreen.html";
const AUDIO_FILE = "assets/cat_sound.mp3";
let offscreenPort = null;
let pendingPortResolvers = [];

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "homework-dog-audio") return;
  offscreenPort = port;
  port.onDisconnect.addListener(() => { offscreenPort = null; });
  const resolvers = pendingPortResolvers.splice(0);
  resolvers.forEach(resolve => resolve());
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "FINALS_AUDIO_START") {
    startFinalsAudio()
      .then(() => sendResponse({ ok: true }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "FINALS_AUDIO_STOP") {
    stopFinalsAudio()
      .then(() => sendResponse({ ok: true }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return false;
});

async function startFinalsAudio() {
  await ensureOffscreenDocument();
  if (!(await waitForOffscreenPort(800))) {
    await recreateOffscreenDocument();
    await waitForOffscreenPort(1200);
  }

  if (!offscreenPort) {
    throw new Error("Audio page did not connect.");
  }

  offscreenPort.postMessage({
    type: "OFFSCREEN_FINALS_AUDIO_START",
    audioUrl: chrome.runtime.getURL(AUDIO_FILE)
  });
}

async function stopFinalsAudio() {
  if (offscreenPort) {
    offscreenPort.postMessage({ type: "OFFSCREEN_FINALS_AUDIO_STOP" });
  }
}

async function waitForOffscreenPort(timeoutMs) {
  if (offscreenPort) return true;

  return new Promise(resolve => {
    const timeout = setTimeout(() => resolve(false), timeoutMs);
    pendingPortResolvers.push(() => {
      clearTimeout(timeout);
      resolve(true);
    });
  });
}

async function ensureOffscreenDocument() {
  if (await hasOffscreenDocument()) return;

  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ["AUDIO_PLAYBACK"],
    justification: "Play the finals-mode Homework Dog sound while the dog eats the page."
  });
}

async function hasOffscreenDocument() {
  if (!chrome.offscreen?.hasDocument) return false;
  return chrome.offscreen.hasDocument();
}

async function recreateOffscreenDocument() {
  offscreenPort = null;

  if (await hasOffscreenDocument()) {
    await chrome.offscreen.closeDocument();
  }

  await ensureOffscreenDocument();
}
