const startButton = document.querySelector("#start");
const stopButton = document.querySelector("#stop");
const screenshotButton = document.querySelector("#screenshot");
const clearButton = document.querySelector("#clear");
const speedSelect = document.querySelector("#speed");
const status = document.querySelector("#status");
const START_MESSAGE = "HOMEWORK_DOG_START_V6";
const UPDATE_MESSAGE = "HOMEWORK_DOG_UPDATE_V6";
const STOP_MESSAGE = "HOMEWORK_DOG_STOP_V6";
const CLEAR_MESSAGE = "HOMEWORK_DOG_CLEAR_V6";

async function sendToActiveTab(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    throw new Error("No active tab found.");
  }

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["content.js"]
  });

  return chrome.tabs.sendMessage(tab.id, message);
}

function setStatus(message) {
  status.textContent = message;
}

startButton.addEventListener("click", async () => {
  try {
    updateFinalsAudioForSelection().catch(() => {});
    await sendToActiveTab({
      type: START_MESSAGE,
      appetite: speedSelect.value
    });
    setStatus("The dog has acquired the assignment.");
  } catch (error) {
    setStatus(error?.message || "Refresh the tab, then try again.");
  }
});

stopButton.addEventListener("click", async () => {
  try {
    await chrome.runtime.sendMessage({ type: "FINALS_AUDIO_STOP" });
    await ensurePageFinalsAudio(false);
    await sendToActiveTab({ type: STOP_MESSAGE });
    setStatus("The dog has been contained.");
  } catch (error) {
    setStatus("No dog is running here.");
  }
});

screenshotButton.addEventListener("click", async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id || !tab?.windowId) {
      throw new Error("No active tab found.");
    }

    if (isProtectedPage(tab.url)) {
      throw new Error("Chrome blocks screenshots on this page.");
    }

    const imageUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
    const evidenceUrl = await addEvidenceText(imageUrl);

    await chrome.downloads.download({
      url: evidenceUrl,
      filename: "evidence.png",
      saveAs: false
    });

    setStatus("Evidence saved as evidence.png.");
  } catch (error) {
    setStatus(error?.message || "Could not capture this page.");
  }
});

clearButton.addEventListener("click", async () => {
  try {
    await chrome.runtime.sendMessage({ type: "FINALS_AUDIO_STOP" });
    await ensurePageFinalsAudio(false);
    await sendToActiveTab({ type: CLEAR_MESSAGE });
    setStatus("Evidence cleaned up.");
  } catch (error) {
    setStatus("Nothing to clean here.");
  }
});

speedSelect.addEventListener("change", async () => {
  updateFinalsAudioForSelection().catch(() => {});

  try {
    await sendToActiveTabIfPresent({
      type: UPDATE_MESSAGE,
      appetite: speedSelect.value
    });
    setStatus("Appetite updated.");
  } catch (error) {
    setStatus("Appetite selected.");
  }
});

async function updateFinalsAudioForSelection() {
  const shouldPlay = speedSelect.value === "finals";
  const messageType = shouldPlay ? "FINALS_AUDIO_START" : "FINALS_AUDIO_STOP";

  try {
    await chrome.runtime.sendMessage({ type: messageType });
  } catch (error) {
    // The active tab fallback below can still play the loop if offscreen audio is blocked.
  }

  await ensurePageFinalsAudio(shouldPlay);
}

async function ensurePageFinalsAudio(shouldPlay) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id || isProtectedPage(tab.url)) {
    return;
  }

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    args: [chrome.runtime.getURL("cat_sound.mp3"), shouldPlay],
    func: (audioUrl, play) => {
      const key = "__homeworkHoundFinalsAudio";

      if (!play) {
        if (window[key]) {
          window[key].pause();
          window[key].currentTime = 0;
          window[key].volume = 0;
        }
        return;
      }

      if (!window[key]) {
        const audio = new Audio(audioUrl);
        audio.loop = true;
        audio.volume = 0;
        window[key] = audio;
      }

      const audio = window[key];
      audio.loop = true;
      audio.volume = 0;

      if (audio.paused) {
        audio.currentTime = 0;
      }

      audio.play().then(() => {
        const startedAt = performance.now();
        const target = 0.72;
        const duration = 7000;

        function fade(now) {
          if (audio.paused) return;

          const progress = Math.min(1, (now - startedAt) / duration);
          audio.volume = target * progress;

          if (progress < 1) {
            requestAnimationFrame(fade);
          }
        }

        requestAnimationFrame(fade);
      }).catch(() => {});
    }
  });
}

async function sendToActiveTabIfPresent(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    throw new Error("No active tab found.");
  }

  return chrome.tabs.sendMessage(tab.id, message);
}

function isProtectedPage(url = "") {
  return (
    url.startsWith("chrome://") ||
    url.startsWith("chrome-extension://") ||
    url.startsWith("edge://") ||
    url.startsWith("about:")
  );
}

function addEvidenceText(imageUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      const text = "my dog ate my homework";
      const scale = Math.max(1, image.width / 1200);
      const padding = 28 * scale;
      const fontSize = Math.max(32, 52 * scale);

      canvas.width = image.width;
      canvas.height = image.height;
      context.drawImage(image, 0, 0);

      context.font = `800 ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      const metrics = context.measureText(text);
      const boxWidth = metrics.width + padding * 2;
      const boxHeight = fontSize + padding * 1.4;
      const x = (canvas.width - boxWidth) / 2;
      const y = padding;

      context.fillStyle = "rgba(255, 248, 232, 0.92)";
      roundRect(context, x, y, boxWidth, boxHeight, 18 * scale);
      context.fill();

      context.strokeStyle = "rgba(80, 48, 26, 0.35)";
      context.lineWidth = 3 * scale;
      context.stroke();

      context.fillStyle = "#24160f";
      context.fillText(text, x + padding, y + padding + fontSize * 0.78);

      resolve(canvas.toDataURL("image/png"));
    };

    image.onerror = reject;
    image.src = imageUrl;
  });
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}
