const AUDIO_FILE = "assets/cat_sound.mp3";
let audio = createAudio(chrome.runtime.getURL(AUDIO_FILE));

let fadeFrame = 0;
let fadeStartedAt = 0;
const targetVolume = 0.72;
const fadeDuration = 7000;

function connect() {
  const port = chrome.runtime.connect({ name: "homework-dog-audio" });
  port.onMessage.addListener((message) => {
    if (message?.type === "OFFSCREEN_FINALS_AUDIO_START") startAudio(message.audioUrl);
    if (message?.type === "OFFSCREEN_FINALS_AUDIO_STOP") stopAudio();
  });
  port.onDisconnect.addListener(connect);
}
connect();

function createAudio(url) {
  const nextAudio = new Audio(url);
  nextAudio.loop = true;
  nextAudio.volume = 0;
  return nextAudio;
}

function startAudio(audioUrl = chrome.runtime.getURL(AUDIO_FILE)) {
  cancelAnimationFrame(fadeFrame);

  if (audio.src !== audioUrl) {
    audio.pause();
    audio = createAudio(audioUrl);
  }

  audio.volume = 0;
  fadeStartedAt = performance.now();
  if (audio.paused) {
    audio.currentTime = 0;
  }
  audio.play().then(() => {
    fadeFrame = requestAnimationFrame(fadeIn);
  }).catch(() => {});
}

function fadeIn(now) {
  const progress = Math.min(1, (now - fadeStartedAt) / fadeDuration);
  audio.volume = targetVolume * progress;

  if (progress < 1) {
    fadeFrame = requestAnimationFrame(fadeIn);
  }
}

function stopAudio() {
  cancelAnimationFrame(fadeFrame);
  audio.pause();
  audio.currentTime = 0;
  audio.volume = 0;
}
