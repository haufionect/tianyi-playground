/* 节奏敲击 —— 四轨道音游
   音符踩着拍子落下来，判定线敲下去。音乐全部用 Web Audio 现场合成。 */
(function () {
  const canvas = document.getElementById('rhythm-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const overlay = document.getElementById('rh-overlay');
  const startBtn = document.getElementById('rh-start');
  const scoreEl = document.getElementById('rh-score');
  const comboEl = document.getElementById('rh-combo');
  const accEl = document.getElementById('rh-acc');
  const laneButtons = Array.prototype.slice.call(document.querySelectorAll('#rh-lanes .lane'));

  const W = 420, H = 560;
  const LANES = 4;
  const LANE_W = W / LANES;
  const JUDGE_Y = H - 104;
  const TRAVEL = 1.45;            // 秒：音符从顶部落到判定线
  const BPM = 108;
  const STEP = 60 / BPM / 2;      // 八分音符
  const PERFECT = 0.085;          // ±85ms 完美
  const GOOD = 0.17;              // ±170ms 还行
  const MISS_AFTER = 0.2;         // 过线 200ms 未敲 = miss

  const LANE_COLORS = ['#66CCFF', '#ff9ec4', '#ffd76e', '#8fe3b0'];
  const LANE_MIDI = [60, 62, 65, 67];             // C D F G
  const BASS_MIDI = [36, 41, 43, 45];

  const SEED = [0, 1, 2, 3, 2, 1, 0, 1, 3, 3, 2, 1, 0, 2, 3, 1,
                0, 1, 2, 3, 3, 2, 1, 0, 1, 3, 2, 0, 0, 0, 1, 1];
  const STEPS = 96;

  let state = null;
  let raf = 0;
  let timer = 0;

  function fit() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  fit();
  window.addEventListener('resize', fit);

  function reset() {
    const startTime = TYAudio.now() + 1.5;   // 一点前奏
    const notes = [];
    const beats = [];
    for (let i = 0; i < STEPS; i++) {
      const lane = SEED[i % SEED.length];
      const breathe = (i % 32 === 31) || (i % 24 === 23);   // 留点呼吸
      if (!breathe) {
        notes.push({ time: startTime + i * STEP, lane: lane, scheduled: false, judged: false, hit: false });
      }
      if (i % 4 === 0) {
        beats.push({ time: startTime + i * STEP, midi: BASS_MIDI[Math.floor(i / 8) % BASS_MIDI.length], scheduled: false });
      }
    }
    state = {
      running: true,
      notes: notes,
      beats: beats,
      lastNoteTime: notes.length ? notes[notes.length - 1].time : startTime,
      startTime: startTime,
      score: 0,
      combo: 0,
      bestCombo: 0,
      perfect: 0,
      good: 0,
      miss: 0,
      sparks: [],
      flash: null,
      laneFlash: [0, 0, 0, 0]
    };
    updateHud();
  }

  function updateHud() {
    scoreEl.textContent = state.score;
    comboEl.textContent = state.combo;
    const judged = state.perfect + state.good + state.miss;
    accEl.textContent = judged ? Math.round((state.perfect * 100 + state.good * 50) / judged) + '%' : '--';
  }

  function addScore(points) {
    state.combo += 1;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    const bonus = 1 + Math.min(state.combo, 60) * 0.02;
    state.score += Math.round(points * bonus);
    updateHud();
  }

  function spark(lane, color, big) {
    for (let i = 0; i < (big ? 14 : 7); i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const s = 60 + Math.random() * 170;
      state.sparks.push({
        x: lane * LANE_W + LANE_W / 2,
        y: JUDGE_Y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.5,
        max: 0.5,
        color: color
      });
    }
  }

  function press(lane) {
    if (!state || !state.running) return;
    state.laneFlash[lane] = 1;
    const now = TYAudio.now();
    let bestNote = null;
    let bestDelta = Infinity;
    for (let i = 0; i < state.notes.length; i++) {
      const n = state.notes[i];
      if (n.judged || n.lane !== lane) continue;
      const d = Math.abs(n.time - now);
      if (d < bestDelta) { bestDelta = d; bestNote = n; }
    }

    if (bestNote && bestDelta <= GOOD) {
      bestNote.judged = true;
      bestNote.hit = true;
      if (bestDelta <= PERFECT) {
        state.perfect += 1;
        addScore(100);
        spark(lane, '#ffd76e', true);
        state.flash = { text: 'PERFECT!', color: '#ffd76e', life: 0.6 };
      } else {
        state.good += 1;
        addScore(50);
        spark(lane, LANE_COLORS[lane], false);
        state.flash = { text: 'GOOD', color: LANE_COLORS[lane], life: 0.5 };
      }
      TYAudio.tone(TYAudio.freqOf(LANE_MIDI[lane] + 12), now, 0.16, { type: 'triangle', gain: 0.2 });
    } else {
      state.combo = 0;
      updateHud();
      TYAudio.tone(130, now, 0.06, { type: 'sine', gain: 0.06 });
    }
  }

  function scheduleAudio() {
    const now = TYAudio.now();
    const horizon = now + 0.4;
    for (let i = 0; i < state.notes.length; i++) {
      const n = state.notes[i];
      if (n.scheduled || n.time > horizon) continue;
      n.scheduled = true;
      TYAudio.tone(TYAudio.freqOf(LANE_MIDI[n.lane]), n.time, 0.34, { type: 'triangle', gain: 0.10 });
    }
    for (let i = 0; i < state.beats.length; i++) {
      const b = state.beats[i];
      if (b.scheduled || b.time > horizon) continue;
      b.scheduled = true;
      TYAudio.tone(TYAudio.freqOf(b.midi), b.time, 0.4, { type: 'sine', gain: 0.12 });
    }
  }

  function tick() {
    if (!state || !state.running) return;
    const now = TYAudio.now();
    scheduleAudio();

    for (let i = 0; i < state.notes.length; i++) {
      const n = state.notes[i];
      if (!n.judged && now > n.time + MISS_AFTER) {
        n.judged = true;
        n.hit = false;
        state.miss += 1;
        state.combo = 0;
        state.flash = { text: 'MISS', color: '#ff6e6e', life: 0.5 };
        updateHud();
      }
    }

    if (now > state.lastNoteTime + 1.1) {
      finish();
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#101a2b');
    g.addColorStop(1, '#0a1120');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const now = TYAudio.now();

    for (let i = 0; i < LANES; i++) {
      if (state && state.laneFlash[i] > 0) {
        ctx.fillStyle = LANE_COLORS[i];
        ctx.globalAlpha = state.laneFlash[i] * 0.14;
        ctx.fillRect(i * LANE_W, 0, LANE_W, H);
        ctx.globalAlpha = 1;
      }
      if (i > 0) {
        ctx.strokeStyle = 'rgba(147,163,192,.18)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(i * LANE_W, 0);
        ctx.lineTo(i * LANE_W, H);
        ctx.stroke();
      }
    }

    // 判定线
    ctx.strokeStyle = 'rgba(102,204,255,.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(8, JUDGE_Y);
    ctx.lineTo(W - 8, JUDGE_Y);
    ctx.stroke();

    if (state) {
      // 音符
      for (let i = 0; i < state.notes.length; i++) {
        const n = state.notes[i];
        if (n.judged) continue;
        const dt = n.time - now;
        if (dt > TRAVEL || dt < -MISS_AFTER - 0.05) continue;
        const y = JUDGE_Y - (dt / TRAVEL) * (JUDGE_Y + 40);
        const pad = 8;
        ctx.fillStyle = LANE_COLORS[n.lane];
        ctx.shadowColor = LANE_COLORS[n.lane];
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.roundRect(n.lane * LANE_W + pad, y - 9, LANE_W - pad * 2, 18, 9);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // 命中粒子
      for (let i = state.sparks.length - 1; i >= 0; i--) {
        const s = state.sparks[i];
        s.x += s.vx * 0.016;
        s.y += s.vy * 0.016;
        s.vy += 420 * 0.016;
        s.life -= 0.016;
        if (s.life <= 0) { state.sparks.splice(i, 1); continue; }
        ctx.globalAlpha = Math.max(s.life / s.max, 0);
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // 判定提示
      if (state.flash && state.flash.life > 0) {
        ctx.globalAlpha = Math.min(state.flash.life * 2, 1);
        ctx.fillStyle = state.flash.color;
        ctx.font = 'bold 23px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(state.flash.text, W / 2, JUDGE_Y - 58);
        ctx.globalAlpha = 1;
      }

      ctx.fillStyle = 'rgba(232,238,251,.85)';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('分数 ' + state.score, 14, 26);
      if (state.combo > 1) {
        ctx.textAlign = 'right';
        ctx.fillStyle = '#ffd76e';
        ctx.fillText(state.combo + ' 连击', W - 14, 26);
      }
    }
  }

  function loop() {
    if (!state || !state.running) return;
    for (let i = 0; i < 4; i++) state.laneFlash[i] = Math.max(0, state.laneFlash[i] - 0.06);
    if (state.flash) state.flash.life -= 0.016;
    draw();
    raf = requestAnimationFrame(loop);
  }

  function start() {
    TYAudio.ensure();
    reset();
    if (overlay) overlay.classList.add('hidden');
    clearInterval(timer);
    timer = setInterval(tick, 25);
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function finish() {
    if (!state || !state.running) return;
    state.running = false;
    clearInterval(timer);
    cancelAnimationFrame(raf);
    const judged = state.perfect + state.good + state.miss;
    const acc = judged ? Math.round((state.perfect * 100 + state.good * 50) / judged) : 0;
    TYAudio.tone(523.25, null, 0.2, { type: 'triangle', gain: 0.18 });
    TYAudio.tone(659.25, TYAudio.now() + 0.14, 0.2, { type: 'triangle', gain: 0.18 });
    TYAudio.tone(783.99, TYAudio.now() + 0.28, 0.4, { type: 'triangle', gain: 0.18 });
    if (overlay) {
      overlay.classList.remove('hidden');
      overlay.innerHTML =
        '<h3>唱完啦 ✧</h3>' +
        '<p>分数 <b>' + state.score + '</b>　命中率 <b>' + acc + '%</b></p>' +
        '<p class="small">完美 ' + state.perfect + ' · 还行 ' + state.good + ' · 漏掉 ' + state.miss + '　最高连击 ' + state.bestCombo + '</p>' +
        '<p class="small">' + (acc >= 90 ? '天依给你鼓掌！(๑•̀ㅂ•́)و' : acc >= 70 ? '不错哦，再来一次会更好~' : '慢慢来，拍子在心里就好~') + '</p>' +
        '<button class="primary" id="rh-start">再来一次</button>';
      const again = document.getElementById('rh-start');
      if (again) again.addEventListener('click', start);
    }
  }

  function stop() {
    if (state) state.running = false;
    clearInterval(timer);
    cancelAnimationFrame(raf);
  }

  if (startBtn) startBtn.addEventListener('click', start);
  laneButtons.forEach(function (btn) {
    const lane = Number(btn.dataset.lane);
    btn.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      TYAudio.ensure();
      press(lane);
    });
    btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  });

  const KEYMAP = { d: 0, f: 1, j: 2, k: 3, D: 0, F: 1, J: 2, K: 3 };
  window.addEventListener('keydown', function (e) {
    const view = document.getElementById('view-rhythm');
    if (!view || !view.classList.contains('active')) return;
    if (e.repeat) return;
    if (e.key in KEYMAP) {
      e.preventDefault();
      TYAudio.ensure();
      press(KEYMAP[e.key]);
      if (laneButtons[KEYMAP[e.key]]) {
        laneButtons[KEYMAP[e.key]].classList.add('hit');
        setTimeout(function (i) { return function () { laneButtons[i].classList.remove('hit'); }; }(KEYMAP[e.key]), 90);
      }
    }
  });

  draw();

  window.TYGames = window.TYGames || {};
  window.TYGames.rhythm = {
    enter: function () { draw(); },
    leave: stop
  };
})();
