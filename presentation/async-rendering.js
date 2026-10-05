(() => {
  const canvas = document.getElementById('async-scene');
  const scene = window.createListScene(canvas);
  const { ctx, rr, text, line, circle, arrow } = scene;
  const C = scene.colors;
  const blue = '#0086ff';
  const warning = '#bf503b';
  const stages = [
    { start: 0, end: 2, title: 'Scroll starts on the UI thread' },
    { start: 2, end: 6, title: 'React prepares the next rows' },
    { start: 6, end: 9, title: 'Native mounting makes rows visible' },
    { start: 9, end: 15, title: 'Scrolling outruns the prepared rows' },
    { start: 15, end: 18, title: 'The missing rows finally arrive' }
  ];
  const duration = stages[stages.length - 1].end;
  let stepIndex = -1;
  let position = 0;
  let playing = false;
  let previous = 0;
  let frameRequest = 0;
  let playbackVersion = 0;
  const assetsReady = scene.ready.then(() => renderFrame());

  function clamp(value, min, max) {
    const lower = Math.max(min, value);
    return Math.min(max, lower);
  }

  function stateAt() {
    if (stepIndex < 0) {
      return { offset: 0, mountedThrough: 10, progress: 0, time: 0, first: 1, last: 5, blanks: 0 };
    }
    const stage = stages[stepIndex];
    const elapsed = position - stage.start;
    const sampledTime = Math.floor(elapsed * 60 + 0.00001) / 60;
    const progress = clamp(sampledTime / (stage.end - stage.start), 0, 1);
    let offset = 0;
    let mountedThrough = 10;
    if (stepIndex === 0) offset = progress * 104;
    if (stepIndex === 1) offset = 104 + progress * 156;
    if (stepIndex === 2) {
      offset = 260 + progress * 52;
      if (progress >= 0.94) mountedThrough = 14;
    }
    if (stepIndex === 3) {
      const scrollProgress = clamp(sampledTime / 2.2, 0, 1);
      offset = 312 + scrollProgress * 1040;
      mountedThrough = 14;
    }
    if (stepIndex === 4) {
      offset = 1352;
      mountedThrough = progress >= 0.94 ? 20 : 14;
    }
    const first = Math.floor(offset / 104) + 1;
    const last = Math.ceil((offset + 514) / 104);
    const blanks = Math.max(0, last - mountedThrough);
    return { offset, mountedThrough, progress, time: sampledTime, first, last, blanks };
  }

  function phone(s) {
    scene.phoneShell('FlatList');
    ctx.save();
    ctx.beginPath();
    ctx.rect(215, 380, 320, 520);
    ctx.clip();
    for (let i = s.first; i <= s.last; i += 1) {
      if (i > s.mountedThrough) continue;
      const rowY = 386 + (i - 1) * 104 - s.offset;
      rr(219, rowY, 312, 90, 14, C.row);
      scene.rowContent(i, rowY, false);
    }
    ctx.restore();
    if (stepIndex === 0 && s.progress < 0.9) {
      const fingerY = 775 - s.progress * 160;
      circle(460, fingerY, 20, '#2f3f7112', '#2f3f7155', 1.5);
      circle(460, fingerY, 9, C.text, '#ffffff', 3);
    }
  }

  function block(x, y, width, title, detail, active, complete, color, titleSize = 27) {
    const fill = active ? color : complete ? '#dce3f2' : C.bg;
    const border = complete ? '#b9c7e4' : C.border;
    const titleColor = active ? '#ffffff' : C.text;
    const detailColor = active ? '#ffffffd9' : C.muted;
    rr(x, y, width, 80, 10, fill, active ? color : border, 1.5);
    text(title, x + 20, y + 27, titleSize, titleColor, 600, 'left', 'Clash Display');
    text(detail, x + 20, y + 58, 22, detailColor);
  }

  function mountToken(progress) {
    const distance = progress * 210;
    if (distance < 15) return { x: 1475 + distance, y: 718 };
    if (distance < 200) return { x: 1490, y: 718 - (distance - 15) };
    return { x: 1490 + distance - 200, y: 533 };
  }

  function timelines(s) {
    const showJS = stepIndex >= 1;
    const showMount = stepIndex >= 2;
    const delayed = stepIndex >= 3;
    const catchingUp = stepIndex === 4;
    const dispatchActive = stepIndex === 1 && s.progress < 0.25;
    const renderActive = (stepIndex === 1 && s.progress >= 0.25) || stepIndex === 3 || (catchingUp && s.progress < 0.35);
    const commitActive = (stepIndex === 2 && s.progress < 0.55) || (catchingUp && s.progress >= 0.35 && s.progress < 0.55);
    const mountActive = (stepIndex === 2 && s.progress >= 0.78) || (catchingUp && s.progress >= 0.78);
    const mounted = delayed ? s.mountedThrough === 20 : s.mountedThrough === 14;
    const renderComplete = stepIndex === 2 || (catchingUp && s.progress >= 0.35);
    const commitComplete = (stepIndex === 2 && s.progress >= 0.55) || (catchingUp && s.progress >= 0.55);
    text('Main / UI thread', 655, 450, 34, C.text, 600, 'left', 'Clash Display');
    const uiEnd = showMount ? 1775 : 955;
    line(655, 533, uiEnd, 533, C.border, 2);
    block(655, 493, 300, 'Native scroll event', 'Native ScrollView', stepIndex < 4, true, blue);
    if (showJS) {
      text('JS thread', 655, 636, 34, C.text, 600, 'left', 'Clash Display');
      line(655, 718, 1475, 718, C.border, 2);
      const renderWidth = delayed ? 395 : 330;
      const rows = delayed ? 'Rows 15–20' : 'Rows 11–14';
      const renderDetail = `${rows} / renderItem`;
      block(800, 678, renderWidth, 'React render', renderDetail, renderActive, renderComplete, delayed ? warning : blue);
      block(1220, 678, 255, 'Commit + layout', 'Renderer / Yoga', commitActive, commitComplete, blue);
      const dispatchColor = dispatchActive ? blue : C.dim;
      arrow(875, 580, 875, 663, dispatchColor, 2);
      text('Scroll event', 903, 598, 22, dispatchActive ? blue : C.muted);
    }
    if (showMount) {
      block(1500, 493, 275, 'Mount native views', 'Apply the update', mountActive, mounted, C.text, 25);
      const mounting = stepIndex === 2 || catchingUp;
      const handoffActive = mounting && s.progress >= 0.55 && s.progress < 0.78;
      const mountColor = handoffActive || mountActive ? blue : C.dim;
      line(1475, 718, 1490, 718, mountColor, 2);
      line(1490, 718, 1490, 533, mountColor, 2);
      arrow(1490, 533, 1500, 533, mountColor, 2);
      text('Schedule mount', 1515, 611, 20, C.muted);
    }
    if (showMount && stepIndex < 4) {
      text('Scrolling continues', 1216, 497, 23, C.muted, 400, 'center');
      const motion = (position * 4) % 1;
      for (let i = 0; i < 9; i += 1) {
        const x = 997 + (i + motion) * 46;
        circle(x, 533, 4, blue);
      }
    }

    let token = null;
    if (dispatchActive) {
      const dispatchProgress = s.progress / 0.25;
      token = { x: 875, y: 580 + dispatchProgress * 83 };
    }
    if (stepIndex === 1 && s.progress >= 0.25) {
      const renderProgress = (s.progress - 0.25) / 0.75;
      token = { x: 800 + renderProgress * 330, y: 778 };
    }
    if (stepIndex === 3 || (catchingUp && s.progress < 0.35)) {
      const renderProgress = stepIndex === 3 ? s.progress : 1;
      const workWidth = 375 * renderProgress;
      line(820, 778, 820 + workWidth, 778, warning, 5);
      token = { x: 820 + workWidth, y: 778 };
    }
    const mounting = stepIndex === 2 || catchingUp;
    if (mounting && (catchingUp === false || s.progress >= 0.35)) {
      const commitStart = catchingUp ? 0.35 : 0;
      const commitProgress = clamp((s.progress - commitStart) / (0.55 - commitStart), 0, 1);
      if (s.progress < 0.55) {
        token = { x: 1220 + commitProgress * 255, y: 778 };
      } else if (s.progress < 0.78) {
        const mountProgress = (s.progress - 0.55) / 0.23;
        token = mountToken(mountProgress);
      } else {
        const mountProgress = (s.progress - 0.78) / 0.22;
        token = { x: 1500 + mountProgress * 275, y: 588 };
      }
    }
    if (token) circle(token.x, token.y, 8, delayed && renderActive ? warning : blue, '#ffffff', 2);
  }

  function renderWindow(s) {
    for (let i = 1; i <= 20; i += 1) {
      const x = 184 + (i - 1) * 79;
      const mounted = i <= s.mountedThrough;
      rr(x, 316, 70, 48, 6, mounted ? '#dce3f2' : C.bg, mounted ? '#b9c7e4' : C.border, 1.5);
      const number = String(i);
      text(number, x + 35, 340, 21, mounted ? C.text : C.dim, 500, 'center');
    }
    const viewportX = 184 + (s.first - 1) * 79;
    const viewportWidth = (s.last - s.first + 1) * 79 - 9;
    const color = s.blanks > 0 ? warning : C.text;
    rr(viewportX - 5, 308, viewportWidth + 10, 64, 9, null, color, 2.5);
    text('Viewport', viewportX, 286, 22, color, 500);
  }

  function renderFrame() {
    const s = stateAt();
    const showThreads = stepIndex >= 0;
    const showFPS = stepIndex >= 3;
    const stage = showThreads ? stages[stepIndex] : null;
    scene.clear();
    ctx.save();
    ctx.translate(0, 44);
    renderWindow(s);
    ctx.save();
    ctx.translate(40.48, 209.44);
    ctx.scale(0.78, 0.78);
    phone(s);
    if (s.blanks > 0) text('Blank content', 535, 865, 23, warning, 500, 'right');
    ctx.restore();
    if (showThreads) timelines(s);
    if (showFPS) {
      text('60', 1580, 842, 74, C.text, 600, 'left', 'Clash Display');
      text('UI FPS', 1700, 842, 24, C.text, 500);
    }
    ctx.restore();
    const phase = stepIndex + 1;
    const phaseLabel = showThreads ? `step ${phase} of ${stages.length}` : 'viewport introduction';
    const title = stage ? stage.title : 'The viewport is the visible part of the list';
    const fpsLabel = showFPS ? 'UI FPS: 60.' : '';
    const visibleParts = showThreads ? 'Phone and Main / UI thread.' : 'Phone and viewport graphic.';
    const jsLabel = stepIndex >= 1 ? 'JS rendering and commit/layout visible.' : '';
    const mountLabel = stepIndex >= 2 ? 'Native mounting visible after commit/layout.' : '';
    const label = `FlatList async rendering, ${phaseLabel}. ${title}. ${visibleParts} ${jsLabel} ${mountLabel} ${fpsLabel} Viewport rows ${s.first} through ${s.last}. Native rows mounted through ${s.mountedThrough}. ${s.blanks} visible rows without native views.`;
    if (canvas.getAttribute('aria-label') !== label) canvas.setAttribute('aria-label', label);
  }

  function notifyState() {
    const event = new Event('media-state-change');
    window.dispatchEvent(event);
  }

  function pause() {
    playing = false;
    playbackVersion += 1;
    cancelAnimationFrame(frameRequest);
    renderFrame();
    notifyState();
  }

  function tick(now) {
    if (playing === false) return;
    const stage = stages[stepIndex];
    position += (now - previous) / 1000;
    previous = now;
    if (position >= stage.end) {
      position = stage.end;
      playing = false;
      notifyState();
    }
    renderFrame();
    if (playing) frameRequest = requestAnimationFrame(tick);
  }

  async function play() {
    if (stepIndex < 0) {
      nextStep();
      return;
    }
    playbackVersion += 1;
    const requestedVersion = playbackVersion;
    await assetsReady;
    if (requestedVersion !== playbackVersion || playing) return;
    const stage = stages[stepIndex];
    if (position >= stage.end) position = stage.start;
    previous = performance.now();
    playing = true;
    frameRequest = requestAnimationFrame(tick);
    notifyState();
  }

  function nextStep() {
    if (stepIndex >= stages.length - 1) return false;
    pause();
    stepIndex += 1;
    position = stages[stepIndex].start;
    renderFrame();
    play();
    return true;
  }

  function previousStep() {
    if (stepIndex < 0) return false;
    pause();
    stepIndex -= 1;
    position = stepIndex >= 0 ? stages[stepIndex].end : 0;
    renderFrame();
    return true;
  }

  function reset(lastStep = false) {
    pause();
    stepIndex = lastStep ? stages.length - 1 : -1;
    position = lastStep ? duration : 0;
    renderFrame();
  }

  function replay() {
    pause();
    position = stepIndex >= 0 ? stages[stepIndex].start : 0;
    renderFrame();
  }

  function startStep(index) {
    pause();
    stepIndex = clamp(index, 0, stages.length - 1);
    position = stages[stepIndex].start;
    renderFrame();
    play();
  }

  renderFrame();
  window.asyncRendering = {
    ready: assetsReady, play, pause, replay, reset, nextStep, previousStep, startStep,
    get stepIndex() { return stepIndex; },
    get playing() { return playing; },
    get position() { return position; },
    stepCount: stages.length,
    duration
  };
})();
