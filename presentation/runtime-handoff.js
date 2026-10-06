(() => {
  const canvas = document.getElementById('runtime-scene');
  const scene = window.createListScene(canvas);
  const { ctx, rr, text, line, circle, arrow } = scene;
  const C = scene.colors;
  const blue = '#0086ff';
  const waitingColor = '#bf503b';
  const stages = [
    { start: 0, end: 2, title: 'Normal JS execution' },
    { start: 2, end: 5, title: 'UI requests synchronous rendering and waits for safe access' },
    { start: 5, end: 7, title: 'Exclusive runtime access passes to the UI thread' },
    { start: 7, end: 11, title: 'React renders on the UI thread while the JS thread waits' },
    { start: 11, end: 13, title: 'Runtime access returns and JS work resumes' }
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

  function mix(start, end, progress) {
    return start + (end - start) * progress;
  }

  function stateAt() {
    const stage = stepIndex >= 0 ? stages[stepIndex] : null;
    const elapsed = stage ? position - stage.start : 0;
    const progress = stage ? elapsed / (stage.end - stage.start) : 0;
    let owner = 'JS';
    let jsStatus = 'Running';
    let uiStatus = 'Idle';
    let transfer = 0;
    let execution = stepIndex === 0 ? progress : 0;
    if (stepIndex === 1) {
      uiStatus = 'Waiting';
      execution = progress;
    }
    if (stepIndex === 2) {
      transfer = progress;
      owner = progress >= 1 ? 'UI' : null;
      jsStatus = 'Waiting';
      uiStatus = progress >= 1 ? 'Running' : 'Waiting';
    }
    if (stepIndex === 3) {
      transfer = 1;
      owner = 'UI';
      jsStatus = 'Waiting';
      uiStatus = 'Running';
      execution = progress;
    }
    if (stepIndex === 4) {
      const release = clamp(progress / 0.7, 0, 1);
      transfer = 1 - release;
      owner = release >= 1 ? 'JS' : null;
      jsStatus = release >= 1 ? 'Running' : 'Waiting';
      uiStatus = 'Idle';
      execution = release >= 1 ? (progress - 0.7) / 0.3 : 1;
    }
    const mounted = stepIndex > 3 || (stepIndex === 3 && progress >= 0.9);
    return { progress, owner, jsStatus, uiStatus, transfer, execution, mounted };
  }

  function accessToken(progress) {
    const distance = progress * 1240;
    if (distance < 270) return { x: 580, y: 580 + distance };
    if (distance < 970) return { x: 580 + distance - 270, y: 850 };
    return { x: 1280, y: 850 - (distance - 970) };
  }

  function thread(name, x, status, active) {
    text(name, x, 410, 38, C.text, 600, 'left', 'Clash Display');
    const statusColor = status === 'Waiting' ? waitingColor : active ? blue : C.muted;
    text(status, x, 466, 29, statusColor, 500);
  }

  function runtime(s) {
    text('React Native runtime', 930, 350, 36, C.text, 600, 'center', 'Clash Display');
    rr(650, 405, 560, 390, 22, C.bg, C.text, 2.5);
    const labels = ['React', 'Components', 'App state'];
    const currentBlock = Math.min(2, Math.floor(s.execution * 3));
    const executing = playing && s.owner !== null;
    for (let i = 0; i < labels.length; i += 1) {
      const y = 455 + i * 100;
      const active = executing && i === currentBlock;
      rr(700, y, 400, 78, 10, active ? '#e0efff' : '#e6e9f1', active ? blue : C.border, 1.5);
      text(labels[i], 900, y + 39, 32, active ? blue : C.text, 500, 'center');
    }
    line(1150, 490, 1150, 735, C.border, 2);
    if (s.owner !== null) {
      const executionY = 490 + s.execution * 245;
      circle(1150, executionY, 9, blue, '#ffffff', 2);
    }
  }

  function workQueue(s) {
    const blocked = s.jsStatus === 'Waiting';
    for (let i = 0; i < 3; i += 1) {
      const x = 215 + i * 74;
      const running = s.owner === 'JS' && playing;
      const phase = (position * 1.4 + i / 3) % 1;
      const fill = blocked ? '#f2ddd7' : running && phase < 0.3 ? '#b9dcff' : '#dce3f2';
      rr(x, 690, 54, 38, 5, fill, blocked ? '#d6a398' : C.border, 1.5);
      if (blocked) {
        line(x + 21, 701, x + 21, 717, waitingColor, 3);
        line(x + 33, 701, x + 33, 717, waitingColor, 3);
      }
    }
  }

  function phone(s) {
    ctx.save();
    ctx.translate(1320, 548);
    ctx.scale(0.48, 0.48);
    scene.phoneShell('VirtualView');
    ctx.save();
    ctx.beginPath();
    ctx.rect(215, 380, 320, 520);
    ctx.clip();
    const offset = s.mounted ? 104 : 0;
    const first = s.mounted ? 2 : 1;
    const last = s.mounted ? 6 : 5;
    for (let i = first; i <= last; i += 1) {
      const rowY = 386 + (i - 1) * 104 - offset;
      const isNew = i === 6;
      rr(219, rowY, 312, 90, 14, isNew ? '#e0efff' : C.row, isNew ? blue : null, 2);
      scene.rowContent(i, rowY, isNew);
    }
    ctx.restore();
    ctx.restore();
  }

  function renderFrame() {
    const s = stateAt();
    scene.clear();
    ctx.save();
    ctx.translate(0, 44);
    thread('JS thread', 184, s.jsStatus, s.owner === 'JS');
    thread('UI thread', 1408, s.uiStatus, s.owner === 'UI');
    const jsColor = s.owner === 'JS' ? blue : C.border;
    const uiColor = s.owner === 'UI' ? blue : C.border;
    line(215, 580, 650, 580, jsColor, s.owner === 'JS' ? 4 : 2);
    line(1210, 580, 1610, 580, uiColor, s.owner === 'UI' ? 4 : 2);
    circle(215, 580, 6, jsColor);
    circle(1610, 580, 6, uiColor);
    runtime(s);
    workQueue(s);
    if (stepIndex >= 1) {
      arrow(1510, 540, 1510, 565, s.uiStatus === 'Waiting' ? waitingColor : C.dim, 2);
    }
    const token = accessToken(s.transfer);
    circle(token.x, token.y, 15, blue, '#ffffff', 3);
    circle(token.x, token.y, 4, '#ffffff');
    phone(s);
    ctx.restore();
    const phase = stepIndex >= 0 ? stages[stepIndex].title : 'Normal JS execution';
    const owner = s.owner === null ? 'Access is being handed over.' : `${s.owner} thread has exclusive runtime access.`;
    const row = s.mounted ? 'New row 6 is mounted and visible.' : 'Phone shows rows 1 through 5.';
    const label = `${phase}. One fixed React Native runtime contains React, components, and app state. ${owner} JS thread: ${s.jsStatus}. UI thread: ${s.uiStatus}. ${row}`;
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
  window.runtimeHandoff = {
    ready: assetsReady, play, pause, replay, reset, nextStep, previousStep, startStep,
    get stepIndex() { return stepIndex; },
    get playing() { return playing; },
    get position() { return position; },
    stepCount: stages.length,
    duration
  };
})();
