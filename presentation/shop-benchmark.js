(() => {
  const slide = document.getElementById('slide-29');
  const dataElement = document.getElementById('benchmark-playback-data');
  const dataText = dataElement.textContent;
  const data = JSON.parse(dataText);
  const memoryGap = slide.querySelector('[data-memory-gap]');
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const runs = [];
  let animationFrame;

  for (const name of ['rnl', 'flashlist']) {
    const video = slide.querySelector(`[data-benchmark-video="${name}"]`);
    const reveals = slide.querySelectorAll(`[data-benchmark-reveal="${name}"]`);
    const valueElements = slide.querySelectorAll(`[data-benchmark-value][data-run="${name}"]`);
    const values = [];
    for (const element of valueElements) {
      const decimals = Number(element.dataset.decimals);
      values.push({ element, key: element.dataset.benchmarkValue, decimals });
    }
    runs.push({ video, reveals, values, data: data[name] });
  }

  function playing() {
    return runs.some(run => run.video.paused === false && run.video.ended === false);
  }

  function render() {
    let finished = true;
    for (const run of runs) {
      const videoDuration = run.video.duration;
      const ratio = videoDuration > 0 ? run.video.currentTime / videoDuration : 0;
      const boundedRatio = Math.min(1, ratio);
      const progress = motionPreference.matches ? 1 : boundedRatio;
      const elapsed = progress * run.data.duration;
      const width = progress === 1 ? 924 : elapsed / 31 * 924;
      const widthText = String(width);
      for (const reveal of run.reveals) reveal.setAttribute('width', widthText);
      let snapshot = run.data.progress[0];
      for (const candidate of run.data.progress) {
        if (candidate.time > elapsed) break;
        snapshot = candidate;
      }
      let legacy = 0;
      for (const point of run.data.legacy) {
        if (point[0] > elapsed) break;
        legacy = point[1];
      }
      for (const value of run.values) {
        const reading = value.key === 'legacy' ? legacy : snapshot[value.key];
        const text = reading === null ? '—' : reading.toFixed(value.decimals);
        if (value.element.textContent !== text) value.element.textContent = text;
      }
      if (progress < 1) finished = false;
    }
    const gapVisible = memoryGap.hasAttribute('hidden') === false;
    if (finished !== gapVisible) {
      if (finished) memoryGap.removeAttribute('hidden');
      else memoryGap.setAttribute('hidden', '');
    }
  }

  function tick() {
    animationFrame = undefined;
    render();
    const isPlaying = playing();
    if (isPlaying && slide.hidden === false) animationFrame = requestAnimationFrame(tick);
  }

  function update() {
    render();
    const isPlaying = playing();
    if (isPlaying && slide.hidden === false) {
      if (animationFrame === undefined) animationFrame = requestAnimationFrame(tick);
    } else if (animationFrame !== undefined) {
      cancelAnimationFrame(animationFrame);
      animationFrame = undefined;
    }
  }

  for (const run of runs) {
    for (const event of ['play', 'pause', 'timeupdate', 'seeking', 'seeked', 'ended', 'loadedmetadata']) {
      run.video.addEventListener(event, update);
    }
  }
  motionPreference.addEventListener('change', update);
  render();
})();
