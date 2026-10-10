/* 接马卡龙 —— 街机小游戏
   接住掉下来的甜点，躲开苦瓜。键盘 / 触屏都能玩。 */
(function () {
  const canvas = document.getElementById('macaron-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const overlay = document.getElementById('mac-overlay');
  const startBtn = document.getElementById('mac-start');
  const scoreEl = document.getElementById('mac-score');
  const bestEl = document.getElementById('mac-best');
  const livesEl = document.getElementById('mac-lives');

  const W = 420, H = 560;
  const PLAYER_W = 76, PLAYER_H = 58, PLAYER_Y = H - 76;
  const BEST_KEY = 'ty_macaron_best';

  let best = Number(localStorage.getItem(BEST_KEY) || 0) || 0;
  bestEl.textContent = best;

  const state = {
    running: false,
    score: 0,
    lives: 3,
    items: [],
    sparks: [],
    playerX: W / 2,
    targetX: W / 2,
    spawnTimer: 0,
    elapsed: 0,
    last: 0,
    raf: 0,
    keys: {},
    shake: 0,
    flash: 0
  };

  const SWEETS = [
    { emoji: '🍰', label: '蛋糕' },
    { emoji: '🧁', label: '杯子蛋糕' },
    { emoji: '🍬', label: '糖果' },
    { emoji: '🍡', label: '团子' }
  ];
  const BADS = [
    { emoji: '🥒', label: '苦瓜' },
    { emoji: '🌶️', label: '辣椒' }
  ];

  function fit() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  fit();
  window.addEventListener('resize', fit);

  function reset() {
    state.score = 0;
    state.lives = 3;
    state.items = [];
    state.sparks = [];
    state.playerX = W / 2;
    state.targetX = W / 2;
    state.spawnTimer = 0.35;
    state.elapsed = 0;
    state.shake = 0;
    state.flash = 0;
    updateHud();
  }

  function updateHud() {
    scoreEl.textContent = state.score;
    livesEl.textContent = state.lives > 0 ? '♥'.repeat(state.lives) : '—';
  }

  function spawn() {
    const isBad = Math.random() < Math.min(0.12 + state.elapsed / 90, 0.34);
    const pool = isBad ? BADS : SWEETS;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    const r = 19;
    state.items.push({
      x: r + Math.random() * (W - r * 2),
      y: -r - 10,
      r: r,
      vy: 95 + Math.min(state.elapsed * 7.5, 190) + Math.random() * 40,
      emoji: pick.emoji,
      bad: isBad,
      spin: (Math.random() - 0.5) * 1.4,
      angle: 0
    });
  }

  function burst(x, y, color) {
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 40 + Math.random() * 130;
      state.sparks.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: 0.55, max: 0.55, color: color });
    }
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#101a2b');
    g.addColorStop(1, '#0a1120');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 26; i++) {
      const x = (i * 97) % W;
      const y = (i * 163) % (H - 120);
      ctx.fillStyle = i % 3 === 0 ? '#66CCFF' : '#ffffff';
      ctx.globalAlpha = 0.10 + (i % 5) * 0.03;
      ctx.beginPath();
      ctx.arc(x, y, i % 4 === 0 ? 1.8 : 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 地面
    ctx.fillStyle = 'rgba(102,204,255,.10)';
    ctx.fillRect(0, PLAYER_Y + PLAYER_H - 4, W, 4);
  }

  function drawPlayer() {
    const x = state.playerX;
    const y = PLAYER_Y;
    ctx.save();
    ctx.translate(x, y);

    // 影子
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath();
    ctx.ellipse(0, PLAYER_H - 2, 30, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // 双马尾（环形辫）
    ctx.fillStyle = '#b9c4d4';
    ctx.beginPath();
    ctx.ellipse(-30, 12, 12, 18, 0, 0, Math.PI * 2);
    ctx.ellipse(30, 12, 12, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    // 身体
    ctx.fillStyle = '#66CCFF';
    ctx.beginPath();
    ctx.roundRect(-24, 16, 48, 38, 12);
    ctx.fill();

    // 头
    ctx.fillStyle = '#e9eef7';
    ctx.beginPath();
    ctx.arc(0, 6, 22, 0, Math.PI * 2);
    ctx.fill();

    // 头发
    ctx.fillStyle = '#c8d2e0';
    ctx.beginPath();
    ctx.arc(0, 2, 22, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-22, 0, 44, 7);

    // 眼睛
    ctx.fillStyle = '#3d4a63';
    ctx.beginPath();
    ctx.arc(-7, 10, 2.6, 0, Math.PI * 2);
    ctx.arc(7, 10, 2.6, 0, Math.PI * 2);
    ctx.fill();

    // 腮红
    ctx.fillStyle = 'rgba(255,158,196,.75)';
    ctx.beginPath();
    ctx.arc(-13, 15, 3.4, 0, Math.PI * 2);
    ctx.arc(13, 15, 3.4, 0, Math.PI * 2);
    ctx.fill();

    // 麦克风
    ctx.fillStyle = '#5b6b85';
    ctx.fillRect(20, 28, 3, 20);
    ctx.fillStyle = '#ffd76e';
    ctx.beginPath();
    ctx.arc(21.5, 26, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawItems() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    state.items.forEach(function (it) {
      ctx.save();
      ctx.translate(it.x, it.y);
      ctx.rotate(it.angle);
      ctx.font = '30px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
      ctx.fillText(it.emoji, 0, 0);
      if (it.bad) {
        ctx.strokeStyle = 'rgba(255,110,110,.55)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, it.r + 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    });
  }

  function drawSparks() {
    state.sparks.forEach(function (s) {
      ctx.globalAlpha = Math.max(s.life / s.max, 0);
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 2.6, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function draw() {
    ctx.save();
    if (state.shake > 0) {
      ctx.translate((Math.random() - 0.5) * state.shake * 14, (Math.random() - 0.5) * state.shake * 14);
    }
    drawBackground();
    drawItems();
    drawPlayer();
    drawSparks();
    ctx.restore();

    if (state.flash > 0) {
      ctx.fillStyle = 'rgba(255,110,110,' + (state.flash * 0.28) + ')';
      ctx.fillRect(0, 0, W, H);
    }

    // 分数
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(232,238,251,.85)';
    ctx.fillText('分数 ' + state.score, 14, 26);
  }

  function step(dt) {
    state.elapsed += dt;

    // 键盘移动
    const speed = 330;
    if (state.keys.left) state.targetX -= speed * dt;
    if (state.keys.right) state.targetX += speed * dt;
    state.targetX = Math.max(PLAYER_W / 2 - 6, Math.min(W - PLAYER_W / 2 + 6, state.targetX));
    state.playerX += (state.targetX - state.playerX) * Math.min(1, dt * 16);

    // 生成
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      spawn();
      const base = Math.max(0.62 - state.elapsed * 0.006, 0.26);
      state.spawnTimer = base + Math.random() * 0.22;
    }

    // 掉落 + 碰撞
    for (let i = state.items.length - 1; i >= 0; i--) {
      const it = state.items[i];
      it.y += it.vy * dt;
      it.angle += it.spin * dt;

      const withinX = Math.abs(it.x - state.playerX) < PLAYER_W / 2 + it.r - 4;
      const withinY = it.y + it.r > PLAYER_Y + 6 && it.y - it.r < PLAYER_Y + PLAYER_H;

      if (withinX && withinY) {
        if (it.bad) {
          state.lives -= 1;
          state.shake = 1;
          state.flash = 1;
          burst(it.x, it.y, '#ff6e6e');
          TYAudio.tone(150, null, 0.22, { type: 'sawtooth', gain: 0.18 });
        } else {
          state.score += 10;
          burst(it.x, it.y, '#ffd76e');
          TYAudio.tone(660 + Math.min(state.score, 900), null, 0.1, { type: 'sine', gain: 0.16 });
        }
        state.items.splice(i, 1);
        updateHud();
        if (state.lives <= 0) {
          gameOver();
          return;
        }
        continue;
      }

      if (it.y - it.r > H) {
        state.items.splice(i, 1);
        if (!it.bad) {
          // 漏掉甜点不扣命，只断连（这里就默默心疼一下）
        }
      }
    }

    // 粒子
    for (let i = state.sparks.length - 1; i >= 0; i--) {
      const s = state.sparks[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 380 * dt;
      s.life -= dt;
      if (s.life <= 0) state.sparks.splice(i, 1);
    }

    state.shake = Math.max(0, state.shake - dt * 3.2);
    state.flash = Math.max(0, state.flash - dt * 3.4);
  }

  function loop(ts) {
    if (!state.running) return;
    if (!state.last) state.last = ts;
    const dt = Math.min((ts - state.last) / 1000, 0.05);
    state.last = ts;
    step(dt);
    if (!state.running) return;
    draw();
    state.raf = requestAnimationFrame(loop);
  }

  function start() {
    TYAudio.ensure();
    reset();
    if (overlay) overlay.classList.add('hidden');
    state.running = true;
    state.last = 0;
    cancelAnimationFrame(state.raf);
    state.raf = requestAnimationFrame(loop);
  }

  function gameOver() {
    state.running = false;
    cancelAnimationFrame(state.raf);
    if (state.score > best) {
      best = state.score;
      localStorage.setItem(BEST_KEY, String(best));
      bestEl.textContent = best;
    }
    TYAudio.tone(330, null, 0.25, { type: 'triangle', gain: 0.18 });
    TYAudio.tone(220, TYAudio.now() + 0.16, 0.4, { type: 'triangle', gain: 0.16 });
    if (overlay) {
      overlay.classList.remove('hidden');
      overlay.innerHTML =
        '<h3>没接住呀 (๑•́ ₃ •̀๑)</h3>' +
        '<p>这一局拿到 <b>' + state.score + '</b> 分，最高分 ' + best + '。</p>' +
        '<p class="small">' + (state.score >= 200 ? '天依都被你喂饱了！' : '再来一局嘛，甜点还有很多~') + '</p>' +
        '<button class="primary" id="mac-start">再来一局</button>';
      const again = document.getElementById('mac-start');
      if (again) again.addEventListener('click', start);
    }
  }

  function stop() {
    state.running = false;
    cancelAnimationFrame(state.raf);
    state.keys.left = state.keys.right = false;
  }

  /* ---- 输入 ---- */
  if (startBtn) startBtn.addEventListener('click', start);

  canvas.addEventListener('pointerdown', function (e) {
    TYAudio.ensure();
    const rect = canvas.getBoundingClientRect();
    state.targetX = (e.clientX - rect.left) / rect.width * W;
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove', function (e) {
    if (e.pressure === 0 && e.buttons === 0) return;
    const rect = canvas.getBoundingClientRect();
    state.targetX = (e.clientX - rect.left) / rect.width * W;
  });

  window.addEventListener('keydown', function (e) {
    const view = document.getElementById('view-macaron');
    if (!view || !view.classList.contains('active')) return;
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { state.keys.left = true; e.preventDefault(); }
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { state.keys.right = true; e.preventDefault(); }
    if (e.key === ' ' && !state.running) { start(); e.preventDefault(); }
  });

  window.addEventListener('keyup', function (e) {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') state.keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') state.keys.right = false;
  });

  draw();
  drawPlayer();

  window.TYGames = window.TYGames || {};
  window.TYGames.macaron = {
    enter: function () { draw(); },
    leave: stop,
    /* 给自动化测试/排错用的小窗口，不影响游戏本身 */
    debug: function () {
      return {
        running: state.running,
        score: state.score,
        lives: state.lives,
        items: state.items.length,
        elapsed: Math.round(state.elapsed * 10) / 10,
        playerX: Math.round(state.playerX),
        targetX: Math.round(state.targetX),
        list: state.items.map(function (it) {
          return { x: Math.round(it.x), y: Math.round(it.y), bad: it.bad };
        })
      };
    }
  };
})();
