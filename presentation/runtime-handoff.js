(() => {
  const canvas = document.getElementById('runtime-scene');
  const scene = window.createListScene(canvas);
  const { ctx, rr, text, line, circle } = scene;
  const C = scene.colors;
  const blue = '#0086ff';
  const waitingColor = '#bf503b';
  const stages = [
    { start: 0, end: 2, title: 'JS prerenders upcoming items 6 through 8' },
    { start: 2, end: 5, title: 'A swipe reaches unfinished items and requests synchronous rendering' },
    { start: 5, end: 7, title: 'Exclusive runtime access passes to the UI thread' },
    { start: 7, end: 11, title: 'UI synchronously renders and mounts items 6 through 8 before presenting the frame' },
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
    let jsStatus = 'Prerendering';
    let uiStatus = 'Idle';
    let transfer = 0;
    let execution = stepIndex === 0 ? progress * 0.45 : 0;
    let scroll = stepIndex >= 2 ? 1 : 0;
    let mountedCount = stepIndex >= 4 ? 3 : 0;
    if (stepIndex === 1) {
      uiStatus = 'Waiting';
      execution = 0.45 + progress * 0.35;
      scroll = clamp(progress / 0.65, 0, 1);
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
      const completed = Math.floor(progress * 3);
      mountedCount = Math.min(3, completed);
      execution = progress >= 1 ? 1 : progress * 3 - completed;
    }
    if (stepIndex === 4) {
      const release = clamp(progress / 0.7, 0, 1);
      transfer = 1 - release;
      owner = release >= 1 ? 'JS' : null;
      jsStatus = release >= 1 ? 'Running' : 'Waiting';
      uiStatus = 'Idle';
      execution = release >= 1 ? (progress - 0.7) / 0.3 : 1;
    }
    return { progress, owner, jsStatus, uiStatus, transfer, execution, scroll, mountedCount };
  }

  function accessToken(progress) {
    return { x: 1160, y: mix(490, 830, progress) };
  }

  function thread(name, y, status, active) {
    text(name, 655, y, 38, C.text, 600, 'left', 'Clash Display');
    const statusColor = status === 'Waiting' ? waitingColor : active ? blue : C.muted;
    text(status, 655, y + 56, 29, statusColor, 500);
  }

  function currentItem(s) {
    if (s.mountedCount >= 3) return null;
    return 6 + s.mountedCount;
  }

  function itemLabel(item) {
    const number = String(item);
    const padded = number.padStart(2, '0');
    return `<Item ${padded} />`;
  }

  function runtime(s) {
    text('App’s Memory', 1522, 350, 38, C.text, 600, 'center', 'Clash Display');
    ctx.save();
    ctx.setLineDash([10, 10]);
    rr(1270, 405, 505, 470, 22, C.bg, C.muted, 2);
    ctx.restore();
    rr(1300, 448, 445, 400, 16, C.bg, C.text, 2);
    text('JS Runtime', 1522, 487, 31, C.text, 600, 'center', 'Clash Display');
    const jsColor = s.owner === 'JS' ? blue : C.border;
    const uiColor = s.owner === 'UI' ? blue : C.border;
    line(1270, 490, 1300, 490, jsColor, s.owner === 'JS' ? 4 : 2);
    line(1270, 830, 1300, 830, uiColor, s.owner === 'UI' ? 4 : 2);
    const executing = playing && s.owner !== null;
    rr(1330, 535, 385, 84, 12, executing ? '#e0efff' : '#e6e9f1', executing ? blue : C.border, 1.5);
    text('React', 1522, 562, 43, executing ? blue : C.text, 500, 'center');
    const item = currentItem(s);
    if (s.owner !== null) {
      const mode = s.owner === 'UI' ? 'UI sync rendering' : 'JS prerendering';
      const label = item === null ? 'Visible rows ready' : mode;
      text(label, 1522, 598, 25, executing ? blue : C.muted, 500, 'center');
    }
    line(1345, 640, 1700, 640, C.border, 2);
    if (s.owner !== null && item !== null) {
      const executionX = 1345 + s.execution * 355;
      circle(executionX, 640, 9, blue, '#ffffff', 2);
    }
    workQueue(s);
  }

  function workQueue(s) {
    const item = currentItem(s);
    if (s.mountedCount >= 3) return;
    for (let i = s.mountedCount; i < 3; i += 1) {
      const y = 674 + i * 52;
      const active = s.owner !== null && item === i + 6;
      const fill = active ? '#b9dcff' : '#e6e9f1';
      const border = active ? blue : C.border;
      rr(1330, y, 385, 44, 5, fill, border, 1.5);
      const label = itemLabel(i + 6);
      text(label, 1522, y + 22, 26, active ? blue : C.text, 500, 'center');
    }
  }

  function frost(s) {
    if (s.jsStatus !== 'Waiting') return;
    let opacity = 1;
    if (stepIndex === 2) opacity = clamp(s.progress / 0.3, 0, 1);
    if (stepIndex === 4) opacity = clamp((0.7 - s.progress) / 0.2, 0, 1);
    ctx.save();
    ctx.globalAlpha = opacity;
    const ice = ctx.createLinearGradient(625, 330, 1230, 540);
    ice.addColorStop(0, '#f5fcffd9');
    ice.addColorStop(0.55, '#d9edfac9');
    ice.addColorStop(1, '#c5e3f3e6');
    rr(625, 330, 605, 210, 22, ice, '#a8cde7', 2.5);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(625, 330, 605, 210, 22);
    ctx.clip();
    const cracks = [
      [640, 342, 695, 365, 684, 393, 731, 414],
      [1214, 345, 1166, 386, 1181, 420, 1137, 453],
      [636, 528, 693, 505, 682, 479, 718, 451],
      [1218, 527, 1169, 497, 1180, 467, 1142, 439]
    ];
    for (const points of cracks) {
      ctx.beginPath();
      ctx.moveTo(points[0], points[1]);
      for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
      ctx.strokeStyle = '#ffffffdf';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    const crystals = [[1083, 371, 17], [1181, 443, 22], [1049, 507, 14]];
    for (const [x, y, radius] of crystals) {
      for (let i = 0; i < 3; i += 1) {
        const angle = i * Math.PI / 3;
        const dx = Math.cos(angle) * radius;
        const dy = Math.sin(angle) * radius;
        line(x - dx, y - dy, x + dx, y + dy, '#ffffff', 2.5);
      }
    }
    ctx.restore();
    text('JS thread', 655, 360, 38, C.text, 600, 'left', 'Clash Display');
    text('Blocked', 655, 421, 37, '#386589', 600, 'left', 'Clash Display');
    text('Waiting for UI thread', 655, 468, 27, '#60829f', 500);
    line(655, 490, 1200, 490, '#8fb8d7', 2);
    ctx.restore();
  }

  function phone(s) {
    ctx.save();
    ctx.translate(18.4, 59.2);
    ctx.scale(0.9, 0.9);
    scene.phoneShell('VirtualView');
    ctx.save();
    ctx.beginPath();
    ctx.rect(215, 380, 320, 520);
    ctx.clip();
    const offset = s.scroll * 312;
    const last = 5 + s.mountedCount;
    for (let i = 1; i <= last; i += 1) {
      const rowY = 386 + (i - 1) * 104 - offset;
      if (rowY + 90 <= 380 || rowY >= 900) continue;
      const isNew = i >= 6;
      rr(219, rowY, 312, 90, 14, isNew ? '#e0efff' : C.row, isNew ? blue : null, 2);
      scene.rowContent(i, rowY, isNew);
    }
    if (s.scroll >= 1 && s.mountedCount < 3) {
      const emptyStart = 386 + last * 104 - offset;
      const labelY = (emptyStart + 900) / 2;
      text('Not mounted yet', 375, labelY, 22, C.muted, 500, 'center');
    }
    ctx.restore();
    if (stepIndex === 1) {
      const fingerY = 790 - s.scroll * 250;
      circle(460, fingerY, 20, '#2f3f7112', '#2f3f7155', 1.5);
      circle(460, fingerY, 9, C.text, '#ffffff', 3);
    }
    ctx.restore();
    if (stepIndex >= 1 && stepIndex <= 3) {
      text('Before frame presentation', 356, 976, 23, C.muted, 500, 'center');
    }
  }

  function renderFrame() {
    const s = stateAt();
    scene.clear();
    ctx.save();
    ctx.translate(0, 44);
    if (s.jsStatus === 'Waiting') {
      text('JS thread', 655, 360, 38, C.text, 600, 'left', 'Clash Display');
    } else {
      thread('JS thread', 360, s.jsStatus, s.owner === 'JS');
    }
    thread('UI thread', 704, s.uiStatus, s.owner === 'UI');
    const jsColor = s.owner === 'JS' ? blue : C.border;
    const uiColor = s.owner === 'UI' ? blue : C.border;
    line(655, 490, 1270, 490, jsColor, s.owner === 'JS' ? 4 : 2);
    line(655, 830, 1270, 830, uiColor, s.owner === 'UI' ? 4 : 2);
    circle(655, 490, 6, jsColor);
    circle(655, 830, 6, uiColor);
    runtime(s);
    frost(s);
    if (stepIndex >= 1 && stepIndex <= 3) {
      const uiWork = stepIndex === 3 ? 'Render + mount visible items' : 'Visible items needed now';
      text(uiWork, 655, 790, 25, s.uiStatus === 'Waiting' ? waitingColor : blue, 500);
    }
    const token = accessToken(s.transfer);
    circle(token.x, token.y, 15, blue, '#ffffff', 3);
    circle(token.x, token.y, 4, '#ffffff');
    phone(s);
    ctx.restore();
    const phase = stepIndex >= 0 ? stages[stepIndex].title : 'Rows 1 through 5 are visible; items 6 through 8 await prerendering';
    const owner = s.owner === null ? 'Access is being handed over.' : `${s.owner} thread has exclusive runtime access.`;
    const visibleRows = s.mountedCount >= 3 ? 'Phone shows rows 4 through 8 with no missing views.' : 'Missing views are shown before frame presentation.';
    const row = s.scroll === 0 ? 'Phone shows rows 1 through 5.' : `Phone has scrolled toward rows 4 through 8. ${s.mountedCount} of 3 upcoming rows mounted. ${visibleRows}`;
    const frostLabel = s.jsStatus === 'Waiting' ? 'JS work is frozen under frost while waiting for the UI thread.' : '';
    const item = currentItem(s);
    const renderedItem = s.owner === null || item === null ? '' : `React work shown for item ${item}.`;
    const label = `${phase}. App's memory contains one fixed JS runtime running React. Its item render work stays inside the runtime during the access handoff. ${owner} JS thread: ${s.jsStatus}. UI thread: ${s.uiStatus}. ${renderedItem} ${frostLabel} ${row}`;
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
