/* 天依琴 —— 八键五声音阶小玩具
   自由弹 + 「跟我唱」记忆小游戏。 */
(function () {
  const keysEl = document.getElementById('pi-keys');
  if (!keysEl) return;

  const modeEl = document.getElementById('pi-mode');
  const streakEl = document.getElementById('pi-streak');
  const hintEl = document.getElementById('pi-hint');
  const demoBtn = document.getElementById('pi-demo');
  const followBtn = document.getElementById('pi-follow');
  const clearBtn = document.getElementById('pi-clear');

  const KEYS = [
    { midi: 60, name: 'do', key: '1' },
    { midi: 62, name: 're', key: '2' },
    { midi: 64, name: 'mi', key: '3' },
    { midi: 67, name: 'so', key: '4' },
    { midi: 69, name: 'la', key: '5' },
    { midi: 72, name: 'do′', key: '6' },
    { midi: 74, name: 're′', key: '7' },
    { midi: 76, name: 'mi′', key: '8' }
  ];

  const DEMO = [0, 0, 4, 4, 5, 5, 4, 2, 2, 1, 1, 0, 2, 4, 2, 0];

  let follow = null;      // { seq: [], input: [], accepting: false, level: 1 }
  let timers = [];
  let mode = 'free';

  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  function play(index, when, dur) {
    const k = KEYS[index];
    if (!k) return;
    const t = when == null ? TYAudio.now() : when;
    TYAudio.tone(TYAudio.freqOf(k.midi), t, dur || 0.5, { type: 'triangle', gain: 0.22 });
    TYAudio.tone(TYAudio.freqOf(k.midi + 12), t, (dur || 0.5) * 0.7, { type: 'sine', gain: 0.06 });
  }

  function flashKey(index, ms) {
    const el = keysEl.querySelector('[data-index="' + index + '"]');
    if (!el) return;
    el.classList.add('playing');
    setTimeout(function () { el.classList.remove('playing'); }, ms || 200);
  }

  function setMode(text) {
    modeEl.textContent = text;
  }

  /* ---------- 键盘渲染 ---------- */
  KEYS.forEach(function (k, i) {
    const btn = document.createElement('button');
    btn.className = 'key';
    btn.dataset.index = String(i);
    btn.innerHTML = k.name + '<span>键 ' + k.key + '</span>';
    btn.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      TYAudio.ensure();
      flashKey(i, 220);
      play(i);
      if (follow && follow.accepting) handleFollowInput(i);
    });
    keysEl.appendChild(btn);
  });

  /* ---------- 自由弹 / 示范曲 ---------- */
  function playDemo() {
    TYAudio.ensure();
    clearTimers();
    if (follow) { follow.accepting = false; follow = null; }
    mode = 'demo';
    setMode('听天依唱');
    hintEl.textContent = '这是天依用五声音阶随便编的小曲子，听完你也能弹~';
    const t0 = TYAudio.now() + 0.12;
    DEMO.forEach(function (idx, i) {
      const at = t0 + i * 0.36;
      play(idx, at, 0.42);
      timers.push(setTimeout(function () { flashKey(idx, 260); }, i * 360 + 120));
    });
    timers.push(setTimeout(function () {
      mode = 'free';
      setMode('自由弹');
    }, DEMO.length * 360 + 400));
  }

  /* ---------- 跟我唱（记忆小游戏） ---------- */
  function startFollow() {
    TYAudio.ensure();
    clearTimers();
    follow = { seq: [], input: [], accepting: false, level: 1 };
    mode = 'follow';
    streakEl.textContent = '0';
    nextFollowRound();
  }

  function nextFollowRound() {
    if (!follow) return;
    follow.seq.push(Math.floor(Math.random() * KEYS.length));
    follow.input = [];
    follow.accepting = false;
    setMode('跟我唱 · 第 ' + follow.level + ' 关');
    hintEl.textContent = '天依先弹 ' + follow.seq.length + ' 个音，你照着弹回来就好~';
    const t0 = TYAudio.now() + 0.35;
    follow.seq.forEach(function (idx, i) {
      play(idx, t0 + i * 0.5, 0.45);
      timers.push(setTimeout(function () { flashKey(idx, 300); }, i * 500 + 350));
    });
    timers.push(setTimeout(function () {
      if (!follow) return;
      follow.accepting = true;
      hintEl.textContent = '换你了！按顺序弹回来（' + follow.seq.length + ' 个音）';
    }, follow.seq.length * 500 + 520));
  }

  function handleFollowInput(index) {
    if (!follow || !follow.accepting) return;
    const expected = follow.seq[follow.input.length];
    if (index !== expected) {
      follow.accepting = false;
      const el = keysEl.querySelector('[data-index="' + index + '"]');
      if (el) {
        el.classList.add('flash-bad');
        setTimeout(function () { el.classList.remove('flash-bad'); }, 320);
      }
      TYAudio.tone(180, null, 0.3, { type: 'sawtooth', gain: 0.14 });
      const reached = follow.seq.length - 1;
      streakEl.textContent = String(reached);
      hintEl.textContent = '到这里就错啦~ 你过了 ' + reached + ' 关，再来一次嘛 (๑•́ ₃ •̀๑)';
      setMode('跟我唱 · 结束');
      follow = null;
      return;
    }
    follow.input.push(index);
    if (follow.input.length === follow.seq.length) {
      follow.accepting = false;
      streakEl.textContent = String(follow.level);
      TYAudio.tone(523.25, null, 0.18, { type: 'triangle', gain: 0.2 });
      TYAudio.tone(659.25, TYAudio.now() + 0.12, 0.3, { type: 'triangle', gain: 0.2 });
      hintEl.textContent = '对了！加一个音~ ✧';
      follow.level += 1;
      timers.push(setTimeout(nextFollowRound, 1100));
    }
  }

  function stopFollow() {
    clearTimers();
    follow = null;
    mode = 'free';
    setMode('自由弹');
    streakEl.textContent = '0';
    hintEl.textContent = '键位：1 2 3 4 5 6 7 8（或直接点键）';
  }

  /* ---------- 事件 ---------- */
  if (demoBtn) demoBtn.addEventListener('click', playDemo);
  if (followBtn) followBtn.addEventListener('click', startFollow);
  if (clearBtn) clearBtn.addEventListener('click', stopFollow);

  window.addEventListener('keydown', function (e) {
    const view = document.getElementById('view-piano');
    if (!view || !view.classList.contains('active')) return;
    const idx = KEYS.map(function (k) { return k.key; }).indexOf(e.key);
    if (idx >= 0) {
      e.preventDefault();
      TYAudio.ensure();
      flashKey(idx, 220);
      play(idx);
      if (follow && follow.accepting) handleFollowInput(idx);
    }
  });

  window.TYGames = window.TYGames || {};
  window.TYGames.piano = {
    enter: function () { setMode(follow ? modeEl.textContent : '自由弹'); },
    leave: function () { stopFollow(); },
    /* 给自动化测试/排错用的小窗口 */
    debug: function () {
      return {
        mode: modeEl.textContent,
        hint: hintEl.textContent,
        streak: streakEl.textContent,
        accepting: !!(follow && follow.accepting),
        level: follow ? follow.level : 0,
        seq: follow ? follow.seq.slice() : []
      };
    }
  };
})();
