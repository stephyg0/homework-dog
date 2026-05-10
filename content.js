(() => {
  const INSTALL_KEY = "__homeworkDogRuntimeV6";
  const START_MESSAGE = "HOMEWORK_DOG_START_V6";
  const UPDATE_MESSAGE = "HOMEWORK_DOG_UPDATE_V6";
  const STOP_MESSAGE = "HOMEWORK_DOG_STOP_V6";
  const CLEAR_MESSAGE = "HOMEWORK_DOG_CLEAR_V6";

  if (window[INSTALL_KEY]) {
    return;
  }

  window[INSTALL_KEY] = true;

  const ROOT_ID = "homework-dog-root";
  const appetiteSettings = {
    casual: { biteEvery: 360, biteCount: 3, biteScale: 1, isHeart: true, speed: 0.55 },
    hungry: { biteEvery: 230, biteCount: 5, biteScale: 1, speed: 0.85 },
    finals: { biteEvery: 70, biteCount: 16, biteScale: 1.85, isFinals: true, speed: 2.7 }
  };
  const DOG_DRAW_WIDTH = 400;
  const DOG_DRAW_HEIGHT = 248;
  const DOG_MOUTH_X = 18;
  const DOG_MOUTH_Y = 106;
  const dogFrameFiles = [
    "chiba.png",
    "chiba2.png"
  ];
  const COVERAGE_STOP_RATIO = 0.92;
  const dogSourceBoxes = [
    { x: 145, y: 295, width: 1010, height: 690 },
    { x: 145, y: 345, width: 1010, height: 640 }
  ];

  let state = null;
  let dogImages = [];
  let finalsAudio = null;
  let finalsAudioFade = 0;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === START_MESSAGE) {
      startDog(message.appetite);
      sendResponse({ ok: true });
      return false;
    }

    if (message?.type === UPDATE_MESSAGE) {
      updateAppetite(message.appetite);
      sendResponse({ ok: true, running: Boolean(state) });
      return false;
    }

    if (message?.type === STOP_MESSAGE) {
      stopDog();
      sendResponse({ ok: true });
      return false;
    }

    if (message?.type === CLEAR_MESSAGE) {
      clearDog();
      sendResponse({ ok: true });
      return false;
    }

    return false;
  });

  function startDog(appetite = "hungry") {
    if (state) {
      updateAppetite(appetite);
      resumeDog();
      state.raf = requestAnimationFrame(tick);
      return;
    }

    loadDogImages();

    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.setAttribute("aria-hidden", "true");
    root.style.position = "fixed";
    root.style.inset = "0";
    root.style.zIndex = "2147483647";
    root.style.pointerEvents = "none";

    const biteCanvas = createLayer();
    const dogCanvas = createLayer();
    root.append(biteCanvas, dogCanvas);
    document.documentElement.append(root);

    const biteContext = biteCanvas.getContext("2d", { alpha: true });
    const dogContext = dogCanvas.getContext("2d", { alpha: true });
    const settings = appetiteSettings[appetite] ?? appetiteSettings.hungry;
    const coverColor = getCoverColor();
    const biteOutlineColor = getBiteOutlineColor(coverColor);

    state = {
      root,
      biteCanvas,
      dogCanvas,
      biteContext,
      dogContext,
      settings,
      coverColor,
      biteOutlineColor,
      bites: [],
      crumbs: [],
      stopped: false,
      raf: 0,
      dog: createDog(settings),
      lastBite: 0,
      startedAt: performance.now()
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas, { passive: true });
    updateFinalsAudio();
    state.raf = requestAnimationFrame(tick);
  }

  function updateAppetite(appetite = "hungry") {
    if (!state) return;

    state.settings = appetiteSettings[appetite] ?? appetiteSettings.hungry;

    if (state.settings.isFinals) {
      state.startedAt = performance.now();
      state.dog.openingRoute = [];
      state.dog.heartRoute = [];
      state.dog.nextWarpAt = 0;
    } else {
      state.dog.rotation = 0;
      if (state.settings.isHeart) {
        const route = createHeartRoute();
        state.dog.heartRoute = route;
        state.dog.heartIndex = 1;
        state.dog.openingRoute = [];
        state.dog.x = route[0].x - DOG_MOUTH_X;
        state.dog.y = route[0].y - DOG_MOUTH_Y;
        state.dog.targetX = route[1].x - DOG_MOUTH_X;
        state.dog.targetY = route[1].y - DOG_MOUTH_Y;
      } else {
        state.dog.heartRoute = [];
        state.dog.openingRoute = createOpeningRoute();
      }
      state.dog.nextTargetAt = 0;
    }

    updateFinalsAudio();
  }

  function resumeDog() {
    if (!state) return;

    state.stopped = false;
    cancelAnimationFrame(state.raf);
    state.dogCanvas.style.display = "block";
  }

  function loadDogImages() {
    if (dogImages.length > 0) return;

    dogImages = dogFrameFiles.map((file) => {
      const image = new Image();
      image.src = chrome.runtime.getURL(file);
      return image;
    });
  }

  function createLayer() {
    const canvas = document.createElement("canvas");
    canvas.style.position = "absolute";
    canvas.style.inset = "0";
    canvas.style.width = "100vw";
    canvas.style.height = "100vh";
    canvas.style.display = "block";
    canvas.style.imageRendering = "pixelated";
    return canvas;
  }

  function createDog(settings = appetiteSettings.hungry) {
    const route = settings.isHeart ? createHeartRoute() : createOpeningRoute();
    const start = settings.isHeart ? route[0] : route.shift();
    const target = settings.isHeart ? route[1] : route.shift();
    const finalsStart = settings.isFinals ? randomMouthPoint(0) : start;
    const finalsTarget = settings.isFinals ? randomMouthPoint(0) : target;

    return {
      x: finalsStart.x - DOG_MOUTH_X,
      y: finalsStart.y - DOG_MOUTH_Y,
      targetX: finalsTarget.x - DOG_MOUTH_X,
      targetY: finalsTarget.y - DOG_MOUTH_Y,
      frame: 0,
      direction: 1,
      rotation: 0,
      wag: 0,
      nextWarpAt: 0,
      nextTargetAt: performance.now() + 5200,
      openingRoute: settings.isHeart ? [] : route,
      heartRoute: settings.isHeart ? route : [],
      heartIndex: settings.isHeart ? 1 : 0
    };
  }

  function createOpeningRoute() {
    const padding = 28;
    const width = Math.max(padding * 2, window.innerWidth);
    const height = Math.max(padding * 2, window.innerHeight);
    const rightX = Math.max(0, width - DOG_DRAW_WIDTH - padding);
    const upperY = safeDogY(height * 0.22, padding);
    const middleY = safeDogY(height * 0.5, padding);
    const lowerY = safeDogY(height * 0.78, padding);

    if (Math.random() < 0.5) {
      return [
        { x: rightX + DOG_MOUTH_X, y: middleY + DOG_MOUTH_Y },
        { x: rightX + DOG_MOUTH_X, y: middleY + DOG_MOUTH_Y },
        safeMouthPoint(width * 0.38, middleY + DOG_MOUTH_Y, padding),
        { x: rightX + DOG_MOUTH_X, y: lowerY + DOG_MOUTH_Y },
        safeMouthPoint(width * 0.62, height - padding, padding),
        safeMouthPoint(padding, middleY + DOG_MOUTH_Y, padding)
      ];
    }

    return [
      { x: rightX + DOG_MOUTH_X, y: lowerY + DOG_MOUTH_Y },
      { x: rightX + DOG_MOUTH_X, y: lowerY + DOG_MOUTH_Y },
      safeMouthPoint(width * 0.62, middleY + DOG_MOUTH_Y, padding),
      safeMouthPoint(padding, upperY + DOG_MOUTH_Y, padding),
      safeMouthPoint(width * 0.38, padding, padding),
      { x: rightX + DOG_MOUTH_X, y: middleY + DOG_MOUTH_Y }
    ];
  }

  function createHeartRoute() {
    const points = [];
    const width = window.innerWidth;
    const height = window.innerHeight;
    const centerX = width * 0.5;
    const centerY = height * 0.44;
    const baseScale = Math.min(
      Math.max(18, (width - DOG_DRAW_WIDTH - 110) / 26),
      Math.max(18, (height - DOG_DRAW_HEIGHT - 160) / 34)
    );
    const scaleX = baseScale * 0.72;
    const scaleY = baseScale * 1.12;

    const count = 112;

    for (let index = 0; index < count; index += 1) {
      const t = (Math.PI * 2 * index) / count;
      let heartX = 16 * Math.sin(t) ** 3;
      const heartY = -(
        13 * Math.cos(t) -
        5 * Math.cos(2 * t) -
        2 * Math.cos(3 * t) -
        Math.cos(4 * t)
      );
      let x = heartX * scaleX;
      let y = heartY * scaleY;

      if (heartY > 4) {
        const taper = clamp((heartY - 4) / 13, 0, 1);
        x *= 1 - taper * 0.52;
        y += taper * scaleY * 1.6;
      }

      if (heartY < -3 && Math.abs(heartX) < 5) {
        const notch = 1 - Math.abs(heartX) / 5;
        y += notch * scaleY * 4.4;
      }

      points.push(safeMouthPoint(centerX + x, centerY + y, 18));
    }

    return points;
  }

  function clearDog() {
    if (!state) {
      document.getElementById(ROOT_ID)?.remove();
      return;
    }

    stopFinalsAudio();
    cancelAnimationFrame(state.raf);
    window.removeEventListener("resize", resizeCanvas);
    state.root.remove();
    state = null;
  }

  function stopDog() {
    if (!state) {
      document.getElementById(ROOT_ID)?.remove();
      return;
    }

    state.stopped = true;
    cancelAnimationFrame(state.raf);
    state.dogCanvas.style.display = "none";
    stopFinalsAudio();
  }

  function resizeCanvas() {
    if (!state) return;

    const ratio = Math.max(1, window.devicePixelRatio || 1);
    for (const canvas of [state.biteCanvas, state.dogCanvas]) {
      canvas.width = Math.floor(window.innerWidth * ratio);
      canvas.height = Math.floor(window.innerHeight * ratio);
    }

    state.biteContext.setTransform(ratio, 0, 0, ratio, 0, 0);
    state.dogContext.setTransform(ratio, 0, 0, ratio, 0, 0);
    redrawBites();
  }

  function updateFinalsAudio() {
    if (!state) return;

    if (state.settings.isFinals) {
      startFinalsAudio();
    } else {
      stopFinalsAudio();
    }
  }

  function startFinalsAudio() {
    chrome.runtime.sendMessage({ type: "FINALS_AUDIO_START" }).catch(() => {});
    startPageFinalsAudio();
  }

  function stopFinalsAudio() {
    chrome.runtime.sendMessage({ type: "FINALS_AUDIO_STOP" }).catch(() => {});
    stopPageFinalsAudio();
  }

  function startPageFinalsAudio() {
    if (!finalsAudio) {
      finalsAudio = new Audio(chrome.runtime.getURL("cat_sound.mp3"));
      finalsAudio.loop = true;
    }

    cancelAnimationFrame(finalsAudioFade);
    finalsAudio.loop = true;
    finalsAudio.volume = 0;

    if (finalsAudio.paused) {
      finalsAudio.currentTime = 0;
    }

    finalsAudio.play().then(() => {
      const startedAt = performance.now();
      const targetVolume = 0.72;
      const duration = 7000;

      function fade(now) {
        if (!finalsAudio || finalsAudio.paused) return;

        const progress = Math.min(1, (now - startedAt) / duration);
        finalsAudio.volume = targetVolume * progress;

        if (progress < 1) {
          finalsAudioFade = requestAnimationFrame(fade);
        }
      }

      finalsAudioFade = requestAnimationFrame(fade);
    }).catch(() => {});
  }

  function stopPageFinalsAudio() {
    cancelAnimationFrame(finalsAudioFade);

    if (!finalsAudio) return;

    finalsAudio.pause();
    finalsAudio.currentTime = 0;
    finalsAudio.volume = 0;
  }

  function tick(now) {
    if (!state || state.stopped) return;

    const { dogContext, dogCanvas, dog, settings } = state;
    dogContext.clearRect(0, 0, dogCanvas.width, dogCanvas.height);

    const elapsed = now - state.startedAt;
    dog.frame = Math.floor(elapsed / 150) % 4;
    dog.wag = Math.sin(elapsed / 110);
    moveDogRandomly(dog, settings, now);

    if (now - state.lastBite > settings.biteEvery) {
      const mouth = getMouthPosition(dog);
      for (let index = 0; index < settings.biteCount; index += 1) {
        addBite(
          mouth.x + randomBetween(-30, 34) * settings.biteScale,
          mouth.y + randomBetween(-34, 34) * settings.biteScale,
          settings.biteScale
        );
      }
      state.lastBite = now;

      if (getEatenCoverage() >= COVERAGE_STOP_RATIO) {
        stopDog();
        return;
      }
    }

    drawFinalsRedTint(dogContext, now);
    updateCrumbs();
    drawCrumbs(dogContext);
    drawDog(dogContext, dog);

    state.raf = requestAnimationFrame(tick);
  }

  function moveDogRandomly(dog, settings, now) {
    if (settings.isFinals) {
      moveDogForFinals(dog, settings, now);
      return;
    }

    const dx = dog.targetX - dog.x;
    const dy = dog.targetY - dog.y;
    const distance = Math.hypot(dx, dy);

    if (distance < 28 || now > dog.nextTargetAt) {
      pickNewTarget(dog, now);
      return;
    }

    const step = Math.min(distance, 2 + settings.speed * 4.2);
    dog.x += (dx / distance) * step;
    dog.y += (dy / distance) * step;

    if (!settings.isHeart) {
      dog.y += Math.sin(now / 140) * 0.7;
    }

    keepDogOnscreen(dog);
  }

  function moveDogForFinals(dog, settings, now) {
    if (now > dog.nextWarpAt) {
      const point = randomMouthPoint(20);
      dog.x = point.x - DOG_MOUTH_X;
      dog.y = point.y - DOG_MOUTH_Y;

      const target = randomMouthPoint(0);
      dog.targetX = target.x - DOG_MOUTH_X;
      dog.targetY = target.y - DOG_MOUTH_Y;
      dog.nextWarpAt = now + randomBetween(180, 520);
    }

    const dx = dog.targetX - dog.x;
    const dy = dog.targetY - dog.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const step = Math.min(distance, 9 + settings.speed * 5);
    dog.x += (dx / distance) * step + randomBetween(-8, 8);
    dog.y += (dy / distance) * step + randomBetween(-8, 8);
    dog.rotation = clamp(dog.rotation + randomBetween(-0.18, 0.22), -0.35, 0.35);

    keepDogOnscreen(dog);
  }

  function pickNewTarget(dog, now) {
    if (state.settings.isHeart) {
      if (!dog.heartRoute.length) {
        dog.heartRoute = createHeartRoute();
        dog.heartIndex = 0;
      }

      dog.heartIndex = (dog.heartIndex + 1) % dog.heartRoute.length;
      const target = dog.heartRoute[dog.heartIndex];
      dog.targetX = target.x - DOG_MOUTH_X;
      dog.targetY = target.y - DOG_MOUTH_Y;
      dog.nextTargetAt = now + 1300;
      return;
    }

    const isOpeningSweep = dog.openingRoute.length > 0;
    const target = isOpeningSweep ? dog.openingRoute.shift() : randomMouthPoint();
    dog.targetX = target.x - DOG_MOUTH_X;
    dog.targetY = target.y - DOG_MOUTH_Y;
    dog.nextTargetAt = now + (isOpeningSweep ? 5200 : randomBetween(1900, 4200));
  }

  function randomMouthPoint(padding = 18) {
    const minX = padding + DOG_MOUTH_X;
    const maxX = Math.max(minX, window.innerWidth - DOG_DRAW_WIDTH + DOG_MOUTH_X - padding);
    const minY = padding + DOG_MOUTH_Y;
    const maxY = Math.max(minY, window.innerHeight - DOG_DRAW_HEIGHT + DOG_MOUTH_Y - padding);
    const roll = Math.random();

    if (roll < 0.24) {
      const corners = [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: minX, y: maxY },
        { x: maxX, y: maxY }
      ];
      const corner = corners[Math.floor(Math.random() * corners.length)];
      return {
        x: clamp(corner.x + randomBetween(-padding, padding), minX, maxX),
        y: clamp(corner.y + randomBetween(-padding, padding), minY, maxY)
      };
    }

    if (roll < 0.54) {
      const edge = Math.floor(Math.random() * 4);

      if (edge === 0) return { x: randomBetween(minX, maxX), y: minY };
      if (edge === 1) return { x: maxX, y: randomBetween(minY, maxY) };
      if (edge === 2) return { x: randomBetween(minX, maxX), y: maxY };
      return { x: minX, y: randomBetween(minY, maxY) };
    }

    return {
      x: randomBetween(minX, maxX),
      y: randomBetween(minY, maxY)
    };
  }

  function keepDogOnscreen(dog) {
    dog.x = clamp(dog.x, 0, Math.max(0, window.innerWidth - DOG_DRAW_WIDTH));
    dog.y = clamp(dog.y, 0, Math.max(0, window.innerHeight - DOG_DRAW_HEIGHT));
  }

  function safeDogY(y, padding) {
    return clamp(y, padding, Math.max(padding, window.innerHeight - DOG_DRAW_HEIGHT - padding));
  }

  function safeMouthPoint(x, y, padding) {
    return {
      x: clamp(x, padding + DOG_MOUTH_X, Math.max(padding + DOG_MOUTH_X, window.innerWidth - DOG_DRAW_WIDTH + DOG_MOUTH_X - padding)),
      y: clamp(y, padding + DOG_MOUTH_Y, Math.max(padding + DOG_MOUTH_Y, window.innerHeight - DOG_DRAW_HEIGHT + DOG_MOUTH_Y - padding))
    };
  }

  function getCoverColor() {
    const bodyColor = getComputedStyle(document.body).backgroundColor;
    const htmlColor = getComputedStyle(document.documentElement).backgroundColor;

    if (bodyColor && bodyColor !== "rgba(0, 0, 0, 0)" && bodyColor !== "transparent") {
      return bodyColor;
    }

    if (htmlColor && htmlColor !== "rgba(0, 0, 0, 0)" && htmlColor !== "transparent") {
      return htmlColor;
    }

    return "#fffaf0";
  }

  function getBiteOutlineColor(color) {
    const luminance = getColorLuminance(color);

    if (luminance !== null && luminance < 0.32) {
      return {
        stroke: "rgba(0, 0, 0, 0.34)",
        shadow: "rgba(255, 255, 255, 0.12)",
        width: 2.5
      };
    }

    return {
      stroke: "rgba(62, 37, 20, 0.26)",
      shadow: "rgba(255, 255, 255, 0.12)",
      width: 2
    };
  }

  function getColorLuminance(color) {
    const rgb = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    const hex = color.match(/^#([a-f\d]{3}|[a-f\d]{6})$/i);
    let red;
    let green;
    let blue;

    if (rgb) {
      red = Number(rgb[1]);
      green = Number(rgb[2]);
      blue = Number(rgb[3]);
    } else if (hex) {
      const value = hex[1].length === 3
        ? hex[1].split("").map((char) => char + char).join("")
        : hex[1];
      red = parseInt(value.slice(0, 2), 16);
      green = parseInt(value.slice(2, 4), 16);
      blue = parseInt(value.slice(4, 6), 16);
    } else {
      return null;
    }

    return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  }

  function addBite(x, y, scale = 1) {
    const radius = (14 + Math.random() * 42) * scale;
    const lobes = 5 + Math.floor(Math.random() * 5);
    const points = [];

    for (let index = 0; index < lobes; index += 1) {
      const angle = (Math.PI * 2 * index) / lobes;
      const wobble = 0.62 + Math.random() * 0.34;
      points.push({
        x: Math.cos(angle) * radius * wobble,
        y: Math.sin(angle) * radius * wobble
      });
    }

    state.bites.push({
      x,
      y,
      radius,
      lobes,
      points
    });

    drawBite(state.biteContext, state.bites[state.bites.length - 1]);

    for (let index = 0; index < 7; index += 1) {
      state.crumbs.push({
        x: x + (Math.random() - 0.5) * radius,
        y: y + (Math.random() - 0.4) * radius,
        vx: (Math.random() - 0.5) * 3,
        vy: -Math.random() * 3,
        size: (3 + Math.random() * 9) * Math.min(1.8, scale),
        life: 36 + Math.random() * 26
      });
    }
  }

  function drawFinalsRedTint(context, now) {
    if (!state.settings.isFinals) return;

    const elapsed = now - state.startedAt;
    const alpha = Math.min(0.42, elapsed / 18000);
    context.save();
    context.fillStyle = `rgba(172, 0, 0, ${alpha})`;
    context.fillRect(0, 0, window.innerWidth, window.innerHeight);
    context.restore();
  }

  function redrawBites() {
    if (!state) return;

    state.biteContext.clearRect(0, 0, state.biteCanvas.width, state.biteCanvas.height);

    for (const bite of state.bites) {
      drawBite(state.biteContext, bite);
    }
  }

  function getEatenCoverage() {
    if (!state || state.bites.length === 0) return 0;

    const sampleSize = 28;
    let eatenSamples = 0;
    let totalSamples = 0;

    for (let y = sampleSize / 2; y < window.innerHeight; y += sampleSize) {
      for (let x = sampleSize / 2; x < window.innerWidth; x += sampleSize) {
        totalSamples += 1;

        if (state.bites.some((bite) => isPointInBite(x, y, bite))) {
          eatenSamples += 1;
        }
      }
    }

    return totalSamples === 0 ? 0 : eatenSamples / totalSamples;
  }

  function isPointInBite(x, y, bite) {
    let inside = false;
    const points = bite.points;

    for (let index = 0, previous = points.length - 1; index < points.length; previous = index, index += 1) {
      const xi = bite.x + points[index].x;
      const yi = bite.y + points[index].y;
      const xj = bite.x + points[previous].x;
      const yj = bite.y + points[previous].y;
      const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

      if (intersects) {
        inside = !inside;
      }
    }

    return inside;
  }

  function drawBite(context, bite) {
    context.save();
    context.fillStyle = state.coverColor;
    context.strokeStyle = state.biteOutlineColor.stroke;
    context.lineWidth = state.biteOutlineColor.width;
    context.shadowColor = state.biteOutlineColor.shadow;
    context.shadowBlur = 2;

    context.beginPath();

    bite.points.forEach((point, index) => {
      const px = bite.x + point.x;
      const py = bite.y + point.y;

      if (index === 0) {
        context.moveTo(px, py);
      } else {
        context.lineTo(px, py);
      }
    });

    context.closePath();
    context.fill();
    context.stroke();

    context.restore();
  }

  function updateCrumbs() {
    for (const crumb of state.crumbs) {
      crumb.x += crumb.vx;
      crumb.y += crumb.vy;
      crumb.vy += 0.12;
      crumb.life -= 1;
    }

    state.crumbs = state.crumbs.filter((crumb) => crumb.life > 0);
  }

  function drawCrumbs(context) {
    context.save();
    context.fillStyle = "#c58b54";

    for (const crumb of state.crumbs) {
      context.globalAlpha = Math.max(0, crumb.life / 54);
      context.fillRect(Math.round(crumb.x), Math.round(crumb.y), crumb.size, crumb.size);
    }

    context.restore();
  }

  function drawDog(context, dog) {
    const x = Math.round(dog.x);
    const y = Math.round(dog.y);
    const frameIndex = dogImages.length > 0 ? Math.floor(dog.frame / 2) % dogImages.length : -1;
    const image = frameIndex >= 0 ? dogImages[frameIndex] : null;
    const centerX = x + DOG_DRAW_WIDTH / 2;
    const centerY = y + DOG_DRAW_HEIGHT / 2;
    const rotation = state.settings.isFinals ? dog.rotation : 0;

    context.save();
    context.imageSmoothingEnabled = false;
    context.translate(centerX, centerY);
    context.rotate(rotation);
    context.translate(-centerX, -centerY);

    if (isLoadedImage(image)) {
      // Draw the user's two supplied dog images as alternating animation frames.
      context.drawImage(
        image,
        dogSourceBoxes[frameIndex].x,
        dogSourceBoxes[frameIndex].y,
        dogSourceBoxes[frameIndex].width,
        dogSourceBoxes[frameIndex].height,
        x,
        y,
        DOG_DRAW_WIDTH,
        DOG_DRAW_HEIGHT
      );
    } else {
      px(context, x, y + 70, 90, 42, "#f2a525");
      px(context, x - 24, y + 82, 32, 18, "#fff1bf");
      px(context, x - 30, y + 88, 12, 8, "#111111");
    }

    context.restore();

    const mouth = getMouthPosition(dog);
    drawChompLines(context, mouth.x - 12, mouth.y, dog.frame);
  }

  function isLoadedImage(image) {
    return Boolean(image && image.complete === true && image.naturalWidth > 0);
  }

  function getMouthPosition(dog) {
    const mouthX = dog.x + DOG_MOUTH_X;
    const mouthY = dog.y + DOG_MOUTH_Y;

    if (!state.settings.isFinals || !dog.rotation) {
      return { x: mouthX, y: mouthY };
    }

    const centerX = dog.x + DOG_DRAW_WIDTH / 2;
    const centerY = dog.y + DOG_DRAW_HEIGHT / 2;
    const dx = mouthX - centerX;
    const dy = mouthY - centerY;
    const cos = Math.cos(dog.rotation);
    const sin = Math.sin(dog.rotation);

    return {
      x: centerX + dx * cos - dy * sin,
      y: centerY + dx * sin + dy * cos
    };
  }

  function drawChompLines(context, x, y, frame) {
    context.save();
    context.strokeStyle = "rgba(88, 53, 28, 0.42)";
    context.lineWidth = 3;

    for (let index = 0; index < 5; index += 1) {
      const angle = Math.PI - 0.65 + index * 0.32;
      const length = frame % 2 === 0 ? 24 : 14;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
      context.stroke();
    }

    context.restore();
  }

  function px(context, x, y, width, height, color) {
    context.fillStyle = color;
    context.fillRect(x, y, width, height);
  }

  function randomBetween(min, max) {
    return min + Math.random() * Math.max(0, max - min);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
})();
