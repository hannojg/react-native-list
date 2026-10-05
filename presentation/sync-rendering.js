(() => {

  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d');
  const duration = 24;
  let stepIndex = -1;
  let position = 0;
  let playing = false;
  let previous = 0;
  let frameRequest = 0;
  let playbackVersion = 0;
  let playbackEnd = duration;
  const C = {
    bg: '#f1f1f1', panel: '#f1f1f1', card: '#f1f1f1', border: '#cbd0dd',
    text: '#2f3f71', muted: '#79839d', dim: '#a8aec0', mint: '#2f3f71',
    phone: '#2f3f71', screen: '#fbfbfc', row: '#edf0f6'
  };
  const swipeColors = ['#0086ff', '#83c4ff', '#b9dcff', '#d5eaff'];
  const gridImage = new Image();
  function loadImage(image, source) {
    return new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = source;
    });
  }
  const gridReady = loadImage(gridImage, 'assets/grid.png');
  const headingReady = document.fonts.load('600 100px "Clash Display"');
  const bodyReady = document.fonts.load('400 30px Satoshi');
  const mediumReady = document.fonts.load('500 30px Satoshi');
  const boldReady = document.fonts.load('700 30px Satoshi');
  let gridPattern;
  const assetPromises = Promise.all([gridReady, headingReady, bodyReady, mediumReady, boldReady]);
  const assetsReady = assetPromises.then(() => {
    gridPattern = ctx.createPattern(gridImage, 'repeat');
    const transform = new DOMMatrix();
    transform.scaleSelf(0.4, 0.4);
    gridPattern.setTransform(transform);
    renderFrame(position);
  });
  const stages = [
    { title: 'Handle the touch', detail: 'MotionEvent.ACTION_MOVE' },
    { title: 'Advance the list', detail: 'RecyclerView → LinearLayoutManager' },
    { title: 'Request the item', detail: 'Recycler → Adapter → item data' },
    { title: 'Bind the item synchronously', detail: 'Adapter.onBindViewHolder() → native views' },
    { title: 'Layout + record drawing', detail: 'Measure / position views / draw' }
  ];
  const cycles = [
    { start: 3.6, end: 13.6, row: 6 },
    { start: 13.6, end: 15.8, row: 7 },
    { start: 15.8, end: 18.0, row: 8 },
    { start: 18.0, end: 20.2, row: 9 }
  ];
  const cuts = [0, 0.13, 0.31, 0.49, 0.77, 1];
  const stepCount = stages.length + 1;

  function clamp(value, min, max) {
    const lower = Math.max(min, value);
    return Math.min(max, lower);
  }
  function smooth(value) {
    const v = clamp(value, 0, 1);
    return v * v * (3 - 2 * v);
  }
  function mix(a, b, t) { return a + (b - a) * t; }
  function rr(x, y, w, h, r, fill, stroke, lineWidth = 1) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
  }
  function text(value, x, y, size, color = C.text, weight = 400, align = 'left', family = 'Satoshi') {
    ctx.font = `${weight} ${size}px "${family}", sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(value, x, y);
  }
  function line(x1, y1, x2, y2, color, width = 2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }
  function circle(x, y, r, fill, stroke, width = 1) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
  }
  function arrow(x1, y1, x2, y2, color, width = 2) {
    line(x1, y1, x2, y2, color, width);
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const a1 = angle - 0.55;
    const a2 = angle + 0.55;
    const hx1 = x2 - Math.cos(a1) * 12;
    const hy1 = y2 - Math.sin(a1) * 12;
    const hx2 = x2 - Math.cos(a2) * 12;
    const hy2 = y2 - Math.sin(a2) * 12;
    line(hx1, hy1, x2, y2, color, width);
    line(hx2, hy2, x2, y2, color, width);
  }
  function swipeSegment(x, y, width, height, fill, first) {
    const leftRadius = first ? 12 : 0;
    const shoulder = x + width - 20;
    const middle = y + height / 2;
    ctx.beginPath();
    ctx.moveTo(x + leftRadius, y);
    ctx.lineTo(shoulder - 5, y);
    ctx.quadraticCurveTo(shoulder, y, shoulder + 3, y + 4);
    ctx.lineTo(x + width - 2, middle - 4);
    ctx.quadraticCurveTo(x + width + 1, middle, x + width - 2, middle + 4);
    ctx.lineTo(shoulder + 3, y + height - 4);
    ctx.quadraticCurveTo(shoulder, y + height, shoulder - 5, y + height);
    ctx.lineTo(x + leftRadius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - leftRadius);
    ctx.lineTo(x, y + leftRadius);
    ctx.quadraticCurveTo(x, y, x + leftRadius, y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }
  function stateAt(t) {
    let index = -1;
    for (let i = 0; i < cycles.length; i += 1) {
      if (t >= cycles[i].start) { index = i; }
    }
    let p = 0;
    let active = -1;
    let offset = 0;
    let fingerTravel = 0;
    if (index >= 0) {
      const cycle = cycles[index];
      const elapsed = (t - cycle.start) / (cycle.end - cycle.start);
      p = clamp(elapsed, 0, 1);
      active = 4;
      for (let s = 0; s < 5; s += 1) {
        if (p >= cuts[s] && p < cuts[s + 1]) { active = s; }
      }
      const layoutProgress = (p - cuts[4]) / (cuts[5] - cuts[4]);
      const advance = smooth(layoutProgress);
      offset = (index + advance) * 104;
      const moveProgress = p / cuts[1];
      const move = smooth(moveProgress);
      fingerTravel = (index + move) * 64;
    }
    return { index, p, active, offset, fingerTravel };
  }

  function touchIndicator(t, s) {
    if (t < 2.0 || t > 21.5) { return; }
    const approachProgress = (t - 2.0) / 1.6;
    const approach = smooth(approachProgress);
    const exitProgress = (t - 20.2) / 1.3;
    const exit = smooth(exitProgress);
    const x = 460;
    const y = mix(775, 708, approach) - s.fingerTravel - exit * 38;
    ctx.save();
    ctx.globalAlpha = approach * (1 - exit);
    const pulse = 0.5 + 0.5 * Math.sin(t * 4);
    circle(x, y, 19 + pulse * 3, '#2f3f7112', '#2f3f7155', 1.5);
    circle(x, y, 9, C.text, '#ffffff', 3);
    ctx.restore();
  }

  function phone(t, s) {
    ctx.save();
    ctx.shadowColor = '#2f3f7118';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 10;
    rr(184, 252, 382, 712, 44, C.phone);
    ctx.restore();
    rr(199, 267, 352, 682, 31, C.screen);
    rr(566, 418, 5, 85, 3, C.text);
    rr(566, 329, 5, 52, 3, C.text);
    text('9:41', 225, 283, 18, C.muted, 500);
    circle(375, 282, 5, C.text);
    for (let j = 0; j < 4; j += 1) {
      const barHeight = 4 + j * 3;
      rr(492 + j * 5, 289 - barHeight, 3, barHeight, 1, C.muted);
    }
    rr(517, 277, 17, 10, 2, null, C.muted, 1.5);
    rr(519, 279, 10, 6, 1, C.muted);
    text('Your feed', 224, 335, 31, C.text, 500);
    text('RecyclerView', 224, 362, 18, C.muted);
    line(215, 379, 535, 379, C.border);

    ctx.save();
    ctx.beginPath();
    ctx.rect(215, 380, 320, 520);
    ctx.clip();
    const target = s.index >= 0 ? cycles[s.index].row : -1;
    for (let i = 1; i <= 11; i += 1) {
      const rowY = 386 + (i - 1) * 104 - s.offset;
      if (rowY + 90 < 380 || rowY > 900) { continue; }
      const isNew = i > 5;
      const isTarget = i === target;
      const isReady = i < target || (isTarget && s.active >= 4) || t >= 20.2;
      const requested = isTarget && s.active >= 2;
      const showContents = isNew ? isReady : true;
      const rowFill = isNew ? '#dce3f2' : C.row;
      rr(219, rowY, 312, 90, 14, rowFill);
      if (requested || (isNew && isReady)) {
        rr(219, rowY, 312, 90, 14, null, C.mint, 2);
      }
      if (showContents) {
        const tileFill = isNew ? '#b9c7e4' : '#dae0ed';
        rr(233, rowY + 17, 52, 56, 10, tileFill);
        const itemLabel = String(i);
        const num = itemLabel.padStart(2, '0');
        text(num, 259, rowY + 45, 20, C.text, 500, 'center');
        text(`Item ${num}`, 301, rowY + 29, 23, C.text, 500);
        rr(301, rowY + 49, 170, 6, 3, '#b3bdd3');
        rr(301, rowY + 63, 116, 6, 3, '#c6cedf');
        if (isNew) { circle(504, rowY + 27, 4, C.mint); }
      } else if (requested) {
        text('Preparing item…', 241, rowY + 45, 22, C.mint);
      }
    }
    ctx.restore();
    rr(319, 926, 112, 5, 3, C.dim);

    if (t >= 2.7 && t < 20.5) {
      ctx.save();
      const showProgress = (t - 2.7) / 0.5;
      ctx.globalAlpha = smooth(showProgress) * 0.8;
      ctx.setLineDash([5, 8]);
      arrow(460, 742, 460, 430, C.mint, 2);
      ctx.setLineDash([]);
      text('swipe', 480, 728, 17, C.mint, 500);
      ctx.restore();
    }
    touchIndicator(t, s);
  }

  function pipeline(t, s) {
    text('Main / UI thread', 784, 291, 35, C.text, 600, 'left', 'Clash Display');
    const finished = t >= 20.2;

    for (let i = 0; i < 5; i += 1) {
      const y = 355 + i * 101;
      const isActive = s.index >= 0 && s.active === i && t < 20.2;
      const complete = finished || (s.index >= 0 && s.active > i);
      if (isActive) { rr(846, y, 930, 85, 0, '#e0e5f1'); }
      if (isActive) { rr(846, y, 5, 85, 2, C.mint); }
      if (i < 4) { line(811, y + 58, 811, y + 143, '#c1c8d8', 2); }
      const discFill = isActive ? C.text : C.bg;
      circle(811, y + 42, 21, discFill, complete ? C.text : C.border, 1.5);
      const numberColor = isActive ? '#ffffff' : complete ? C.text : C.muted;
      const stageNumber = String(i + 1);
      text(stageNumber, 811, y + 42, 21, numberColor, 500, 'center');
      text(stages[i].title, 869, y + 27, 32, C.text, 600, 'left', 'Clash Display');
      const targetRow = s.index >= 0 ? cycles[s.index].row : 6;
      const targetLabel = String(targetRow);
      const itemNumber = targetLabel.padStart(2, '0');
      const detail = i === 2 ? `Recycler → Adapter → Item ${itemNumber}` : stages[i].detail;
      text(detail, 869, y + 59, 22, isActive ? C.mint : C.muted);
      if (isActive) {
        const status = playing ? 'running' : 'selected';
        text(status, 1753, y + 27, 18, C.text, 500, 'right');
      }
      if (complete) { text('done', 1753, y + 27, 18, C.muted, 500, 'right'); }
    }

    const stripY = 927;
    const currentSwipe = s.index >= 0 ? s.index : 0;
    for (let j = 3; j >= 0; j -= 1) {
      const x = 978 + j * 190;
      const distance = Math.abs(j - currentSwipe);
      const fill = swipeColors[distance];
      swipeSegment(x, stripY - 24, 210, 48, fill, j === 0);
    }
    for (let j = 0; j < 4; j += 1) {
      const x = 978 + j * 190;
      const updateLabel = String(j + 1);
      const updateNumber = updateLabel.padStart(2, '0');
      const color = j <= currentSwipe ? '#ffffff' : '#ffffffb8';
      text(`Swipe ${updateNumber}`, x + 95, stripY, 26, color, 500, 'center');
    }
  }

  function connection(t, s) {
    const active = s.index >= 0 && t < 20.2;
    const color = active ? C.mint : C.dim;
    arrow(592, 439, 731, 439, color, 2);
    text('TOUCH', 661, 414, 17, active ? C.mint : C.muted, 500, 'center');
    arrow(731, 794, 592, 794, color, 2);
    text('READY', 661, 822, 17, active ? C.mint : C.muted, 500, 'center');
    if (active) {
      const localProgress = (s.p - cuts[s.active]) / (cuts[s.active + 1] - cuts[s.active]);
      const local = clamp(localProgress, 0, 1);
      if (s.active === 0) {
        const x = mix(592, 731, local);
        circle(x, 439, 6, C.mint);
      }
      if (s.active === 4) {
        const x = mix(731, 592, local);
        circle(x, 794, 6, C.mint);
      }
    }
  }

  function renderFrame(t) {
    ctx.clearRect(0, 0, 1920, 1080);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, 1920, 1080);
    if (gridPattern) {
      ctx.fillStyle = gridPattern;
      ctx.fillRect(0, 0, 1920, 1080);
    }
    const s = stateAt(t);
    ctx.save();
    ctx.translate(0, 44);
    phone(t, s);
    pipeline(t, s);
    connection(t, s);
    ctx.restore();
  }
  renderFrame(0);


  function notifyState() {
    const event = new Event('media-state-change');
    window.dispatchEvent(event);
  }

  function pause() {
    playing = false;
    playbackVersion += 1;
    cancelAnimationFrame(frameRequest);
    renderFrame(position);
    notifyState();
  }

  function tick(now) {
    if (playing === false) return;
    const elapsed = (now - previous) / 1000;
    position += elapsed;
    previous = now;
    if (position >= playbackEnd) {
      position = playbackEnd;
      playing = false;
      notifyState();
    }
    renderFrame(position);
    if (playing) frameRequest = requestAnimationFrame(tick);
  }

  async function playUntil(until) {
    playbackVersion += 1;
    const requestedVersion = playbackVersion;
    await assetsReady;
    if (requestedVersion !== playbackVersion) return;
    if (playing) return;
    if (position >= duration) position = 0;
    playbackEnd = until;
    previous = performance.now();
    playing = true;
    frameRequest = requestAnimationFrame(tick);
    notifyState();
  }

  function seek(time) {
    position = clamp(time, 0, duration);
    renderFrame(position);
  }

  function reset(lastStep = false) {
    pause();
    stepIndex = lastStep ? stepCount - 1 : -1;
    const time = lastStep ? duration : 0;
    seek(time);
  }

  function stepTimes(index) {
    if (index === stages.length) {
      return { start: cycles[1].start + 0.001, end: duration };
    }
    const cycle = cycles[0];
    const cycleDuration = cycle.end - cycle.start;
    const start = cycle.start + cycleDuration * cuts[index] + 0.001;
    const boundary = cycle.start + cycleDuration * cuts[index + 1];
    const end = boundary - 0.001;
    return { start, end };
  }

  function playStep(index) {
    const times = stepTimes(index);
    pause();
    stepIndex = index;
    seek(times.start);
    return playUntil(times.end);
  }

  function nextStep() {
    if (stepIndex >= stepCount - 1) return false;
    const index = stepIndex + 1;
    playStep(index);
    return true;
  }

  function previousStep() {
    if (stepIndex < 0) return false;
    pause();
    stepIndex -= 1;
    if (stepIndex >= 0) {
      const times = stepTimes(stepIndex);
      seek(times.end);
    } else seek(0);
    return true;
  }

  function resumeStep() {
    if (stepIndex < 0) {
      nextStep();
      return;
    }
    const times = stepTimes(stepIndex);
    if (position >= times.end) playStep(stepIndex);
    else playUntil(times.end);
  }

  window.syncRendering = {
    ready: assetsReady,
    play: resumeStep,
    pause,
    seek,
    replay: reset,
    reset,
    nextStep,
    previousStep,
    get stepIndex() { return stepIndex; },
    stepCount,
    get playing() { return playing; },
    get position() { return position; },
    duration
  };
})();
