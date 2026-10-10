/* 天依小乐园 · 共用音频工具
   全程用 Web Audio 现场合成，不依赖任何音频文件。 */
(function () {
  let ctx = null;
  let master = null;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.72;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
    return ctx;
  }

  /* 一个带简单包络的音符 */
  function tone(freq, when, dur, opts) {
    const c = ensure();
    if (!c) return;
    opts = opts || {};
    const start = Math.max(when == null ? c.currentTime : when, c.currentTime);
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = opts.type || 'triangle';
    osc.frequency.setValueAtTime(freq, start);
    const peak = opts.gain == null ? 0.22 : opts.gain;
    const attack = opts.attack == null ? 0.01 : opts.attack;
    const total = Math.max(dur || 0.25, 0.06);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(peak, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + total);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + total + 0.03);
  }

  /* 音高名 → 频率（十二平均律，A4 = 440） */
  function freqOf(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  /* roundRect 兜底：老一点的移动端浏览器可能没有这个方法 */
  if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      const radius = Math.min(typeof r === 'number' ? r : 8, w / 2, h / 2);
      this.moveTo(x + radius, y);
      this.lineTo(x + w - radius, y);
      this.quadraticCurveTo(x + w, y, x + w, y + radius);
      this.lineTo(x + w, y + h - radius);
      this.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
      this.lineTo(x + radius, y + h);
      this.quadraticCurveTo(x, y + h, x, y + h - radius);
      this.lineTo(x, y + radius);
      this.quadraticCurveTo(x, y, x + radius, y);
      return this;
    };
  }

  window.TYAudio = {
    ensure: ensure,
    tone: tone,
    freqOf: freqOf,
    now: function () { return ctx ? ctx.currentTime : 0; }
  };
})();
