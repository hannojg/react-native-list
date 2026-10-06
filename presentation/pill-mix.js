(() => {
  const slide = document.querySelector('.pill-mix');
  const pillElements = slide.querySelectorAll('.mix-pill');
  const pills = Array.from(pillElements);
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let animations = [];
  let generation = 0;
  let mixing = false;

  function stop() {
    generation += 1;
    for (const animation of animations) animation.cancel();
    animations = [];
    mixing = false;
  }

  function enter(showAll = false) {
    stop();
    for (const [index, pill] of pills.entries()) {
      pill.style.transform = '';
      pill.style.opacity = '';
      const label = pill.firstElementChild;
      label.style.opacity = '1';
      label.style.transform = '';
      if (showAll || motionPreference.matches) continue;
      const entrance = label.animate([
        { opacity: 0, transform: 'scale(0.15)' },
        { opacity: 1, transform: 'scale(1.08)', offset: 0.72 },
        { opacity: 1, transform: 'scale(1)' }
      ], {
        duration: 460,
        delay: index * 180,
        easing: 'cubic-bezier(.2,.7,.25,1)',
        fill: 'both'
      });
      animations.push(entrance);
    }
  }

  function swirlFrames(pill, index) {
    const x = Number(pill.dataset.x);
    const y = Number(pill.dataset.y);
    const dx = x - 960;
    const dy = y - 540;
    const radius = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const frames = [];
    for (let step = 0; step <= 32; step += 1) {
      const progress = step / 32;
      const remaining = 1 - progress;
      const distance = radius * remaining ** 1.3;
      const rotation = angle + progress * Math.PI * 2.2;
      const offsetX = 960 + Math.cos(rotation) * distance - x;
      const offsetY = 540 + Math.sin(rotation) * distance - y;
      const tilt = Math.sin(progress * Math.PI) * (index % 2 === 0 ? 18 : -18);
      const scale = 1 - progress * 0.78;
      const opacity = progress < 0.8 ? 1 : 1 - (progress - 0.8) * 3;
      frames.push({
        offset: progress,
        transform: `translate(-50%, -50%) translate(${offsetX}px, ${offsetY}px) rotate(${tilt}deg) scale(${scale})`,
        opacity
      });
    }
    return frames;
  }

  async function mixTo(onComplete) {
    if (mixing) return;
    enter(true);
    mixing = true;
    const activeGeneration = generation;
    if (motionPreference.matches) {
      onComplete();
      return;
    }
    const completions = [];
    for (const [index, pill] of pills.entries()) {
      const label = pill.firstElementChild;
      const vibration = label.animate([
        { transform: 'translate(-3px, 1px) rotate(-1deg)' },
        { transform: 'translate(3px, -1px) rotate(1deg)' },
        { transform: 'translate(0, 0) rotate(0)' }
      ], { duration: 85, iterations: 8 });
      const frames = swirlFrames(pill, index);
      const swirl = pill.animate(frames, {
        duration: 1850,
        delay: 680,
        easing: 'cubic-bezier(.45,0,.3,1)',
        fill: 'forwards'
      });
      animations.push(vibration, swirl);
      completions.push(swirl.finished);
    }
    try {
      await Promise.all(completions);
    } catch (error) {
      if (error.name === 'AbortError') return;
      throw error;
    }
    if (activeGeneration !== generation) return;
    for (const pill of pills) {
      const x = Number(pill.dataset.x);
      const y = Number(pill.dataset.y);
      pill.style.transform = `translate(-50%, -50%) translate(${960 - x}px, ${540 - y}px) scale(0.22)`;
      pill.style.opacity = '0.4';
    }
    onComplete();
  }

  window.pillMix = { enter, stop, mixTo, get mixing() { return mixing; } };
})();
