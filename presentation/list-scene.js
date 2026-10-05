(() => {
  const C = {
    bg: '#f1f1f1', panel: '#f1f1f1', card: '#f1f1f1', border: '#cbd0dd',
    text: '#2f3f71', muted: '#79839d', dim: '#a8aec0', mint: '#2f3f71',
    phone: '#2f3f71', screen: '#fbfbfc', row: '#edf0f6'
  };
  window.createListScene = canvas => {
    const ctx = canvas.getContext('2d');
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
    });
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
    function phoneShell(subtitle) {
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
      text(subtitle, 224, 362, 18, C.muted);
      line(215, 379, 535, 379, C.border);

      rr(319, 926, 112, 5, 3, C.dim);
    }
    function rowContent(i, rowY, isNew) {
      const tileFill = isNew ? '#b9c7e4' : '#dae0ed';
      rr(233, rowY + 17, 52, 56, 10, tileFill);
      const itemLabel = String(i);
      const num = itemLabel.padStart(2, '0');
      text(num, 259, rowY + 45, 20, C.text, 500, 'center');
      text(`Item ${num}`, 301, rowY + 29, 23, C.text, 500);
      rr(301, rowY + 49, 170, 6, 3, '#b3bdd3');
      rr(301, rowY + 63, 116, 6, 3, '#c6cedf');
      if (isNew) { circle(504, rowY + 27, 4, C.mint); }
    }
    function clear() {
      ctx.clearRect(0, 0, 1920, 1080);
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, 1920, 1080);
      if (gridPattern) {
        ctx.fillStyle = gridPattern;
        ctx.fillRect(0, 0, 1920, 1080);
      }
    }
    return { ctx, colors: C, ready: assetsReady, clear, rr, text, line, circle, arrow, phoneShell, rowContent };
  };
})();
