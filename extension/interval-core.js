/*
 * Interval Ride — 실내자전거 30분 인터벌 타이머 (공용 엔진 + 오버레이 UI)
 *
 * 크롬 확장(YouTube 위 오버레이)과 단독 페이지(timer.html)가 함께 사용합니다.
 * 운동 구성은 아래 PROGRAM 배열만 고치면 바뀝니다. [종류, 초]
 */
(function (global) {
  'use strict';
  if (global.IntervalRide) return;

  // 원본 영상(youtu.be/xEhPT6ydXRY)의 화면 타이머를 그대로 옮긴 구성, 총 30분
  const PROGRAM = [
    ['warmup', 300],
    ['sprint', 60],
    ['recovery', 60],
    ['sprint', 120],
    ['recovery', 60],
    ['sprint', 60],
    ['recovery', 60],
    ['sprint', 120],
    ['recovery', 60],
    ['sprint', 180],
    ['recovery', 120],
    ['sprint', 120],
    ['recovery', 60],
    ['sprint', 120],
    ['cooldown', 300],
  ].map(([kind, sec]) => ({ kind, sec }));

  const KINDS = {
    warmup: { label: 'WARM UP', ko: '워밍업', color: '#5f8dff', level: 0.4 },
    sprint: { label: 'SPRINT', ko: '전력 페달링', color: '#ff3d57', level: 1 },
    recovery: { label: 'RECOVERY', ko: '회복', color: '#ffd84a', level: 0.55 },
    cooldown: { label: 'COOL DOWN', ko: '쿨다운', color: '#5f8dff', level: 0.32 },
  };

  const STARTS = [];
  let acc = 0;
  for (const p of PROGRAM) {
    STARTS.push(acc);
    acc += p.sec;
  }
  const TOTAL = acc;

  function fmt(sec) {
    sec = Math.max(0, Math.ceil(sec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function fmtShort(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return s ? m + ':' + String(s).padStart(2, '0') : m + ':00';
  }

  // 경과 시간(초) → 현재 구간 정보
  function phaseAt(elapsed) {
    if (elapsed >= TOTAL) return { index: PROGRAM.length, done: true };
    let i = PROGRAM.length - 1;
    while (i > 0 && STARTS[i] > elapsed) i--;
    const p = PROGRAM[i];
    const into = elapsed - STARTS[i];
    return { index: i, done: false, phase: p, into, remaining: p.sec - into, frac: into / p.sec };
  }

  const ICONS = {
    play: '<path d="M8 5.5v13l11-6.5z"/>',
    pause: '<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/>',
    prev: '<path d="M6 5h2.5v14H6zM19 5.5v13L9.5 12z"/>',
    next: '<path d="M15.5 5H18v14h-2.5zM5 5.5v13l9.5-6.5z"/>',
    reset: '<path d="M12 5a7 7 0 1 1-6.6 9.3l2.3-.8A4.6 4.6 0 1 0 12 7.4V10L7.5 6.2 12 2.5z"/>',
    sound: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4zM15 8.5a5 5 0 0 1 0 7l-1.4-1.4a3 3 0 0 0 0-4.2zM17.6 6a8.5 8.5 0 0 1 0 12l-1.4-1.4a6.5 6.5 0 0 0 0-9.2z"/>',
    mute: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4zM14.5 9.6l1.4-1.4 2.1 2.1 2.1-2.1 1.4 1.4-2.1 2.1 2.1 2.1-1.4 1.4-2.1-2.1-2.1 2.1-1.4-1.4 2.1-2.1z"/>',
    close: '<path d="M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4z"/>',
  };

  function icon(name) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS[name] + '</svg>';
  }

  const CIRC = 2 * Math.PI * 45;

  function create(opts) {
    opts = Object.assign({ storageKey: 'intervalRide.v1', closable: false }, opts);

    // ---------- 상태 (경과시간은 타임스탬프 기반이라 새로고침해도 이어집니다) ----------
    let state = { acc: 0, startedAt: null, muted: false, visible: true };

    function load() {
      try {
        const raw = global.localStorage.getItem(opts.storageKey);
        if (raw) state = Object.assign(state, JSON.parse(raw));
      } catch (e) { /* 저장소를 못 쓰면 메모리 상태로만 동작 */ }
      // 운동이 끝난 지 한참 지난 기록은 초기화
      if (elapsedMs() > (TOTAL + 3600) * 1000) {
        state.acc = 0;
        state.startedAt = null;
      }
    }

    function save() {
      try {
        global.localStorage.setItem(opts.storageKey, JSON.stringify(state));
      } catch (e) { /* 무시 */ }
    }

    function elapsedMs() {
      return state.acc + (state.startedAt != null ? Date.now() - state.startedAt : 0);
    }

    const running = () => state.startedAt != null;

    // ---------- 소리 ----------
    let audio = null;
    function ensureAudio() {
      try {
        const AC = global.AudioContext || global.webkitAudioContext;
        if (!audio && AC) audio = new AC();
        if (audio && audio.state === 'suspended') audio.resume();
      } catch (e) { audio = null; }
    }

    function tone(freq, dur, delay, vol) {
      if (state.muted || !audio) return;
      try {
        const t = audio.currentTime + (delay || 0);
        const o = audio.createOscillator();
        const g = audio.createGain();
        o.type = 'sine';
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol || 0.3, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(audio.destination);
        o.start(t);
        o.stop(t + dur + 0.05);
      } catch (e) { /* 무시 */ }
    }

    function cuePhase(kind) {
      if (kind === 'sprint') {
        tone(880, 0.16, 0);
        tone(1320, 0.45, 0.17);
      } else if (kind === 'done') {
        tone(660, 0.2, 0);
        tone(880, 0.2, 0.22);
        tone(1100, 0.6, 0.44);
      } else {
        tone(660, 0.5, 0);
      }
    }

    // ---------- DOM ----------
    const root = document.createElement('div');
    root.className = 'ir-root';
    root.setAttribute('translate', 'no');
    root.innerHTML =
      '<div class="ir-badge">' +
        '<button type="button" class="ir-dial" data-act="toggle" aria-label="시작 또는 일시정지">' +
          '<svg class="ir-ring" viewBox="0 0 100 100" aria-hidden="true">' +
            '<circle class="ir-disc" cx="50" cy="50" r="49"/>' +
            '<circle class="ir-track" cx="50" cy="50" r="45"/>' +
            '<circle class="ir-arc" cx="50" cy="50" r="45" transform="rotate(-90 50 50)"/>' +
          '</svg>' +
          '<span class="ir-time">05:00</span>' +
        '</button>' +
        '<div class="ir-text">' +
          '<div class="ir-sub"></div>' +
          '<div class="ir-label"></div>' +
        '</div>' +
      '</div>' +
      '<div class="ir-controls">' +
        '<button type="button" data-act="prev" aria-label="이전 구간" title="이전 구간">' + icon('prev') + '</button>' +
        '<button type="button" data-act="toggle" class="ir-play" aria-label="시작" title="시작/일시정지">' + icon('play') + '</button>' +
        '<button type="button" data-act="next" aria-label="다음 구간" title="다음 구간">' + icon('next') + '</button>' +
        '<button type="button" data-act="reset" aria-label="처음부터" title="처음부터">' + icon('reset') + '</button>' +
        '<button type="button" data-act="mute" class="ir-mute" aria-label="소리 끄기" title="소리 켜기/끄기">' + icon('sound') + '</button>' +
        (opts.closable ? '<button type="button" data-act="hide" aria-label="타이머 숨기기" title="숨기기 (확장 아이콘으로 다시 표시)">' + icon('close') + '</button>' : '') +
      '</div>';

    const $ = (sel) => root.querySelector(sel);
    const elTime = $('.ir-time');
    const elLabel = $('.ir-label');
    const elSub = $('.ir-sub');
    const elArc = $('.ir-arc');
    const elPlay = $('.ir-play');
    const elMute = $('.ir-mute');
    elArc.style.strokeDasharray = '0 ' + CIRC;

    root.addEventListener('click', (ev) => {
      const btn = ev.target.closest('button[data-act]');
      if (!btn || !root.contains(btn)) return;
      ev.preventDefault();
      ev.stopPropagation();
      ensureAudio();
      actions[btn.dataset.act]();
    });
    // YouTube 플레이어가 클릭/더블클릭을 재생·전체화면으로 처리하지 않도록 막음
    ['dblclick', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'touchstart', 'touchend'].forEach((t) =>
      root.addEventListener(t, (ev) => {
        if (ev.target.closest('button')) ev.stopPropagation();
      })
    );

    // ---------- 동작 ----------
    let lastIndex = null;
    let lastRemain = null;
    const listeners = [];

    function seekTo(sec) {
      sec = Math.min(Math.max(0, sec), TOTAL);
      state.acc = sec * 1000;
      if (running()) state.startedAt = Date.now();
      if (sec >= TOTAL) state.startedAt = null;
      const ph = phaseAt(sec);
      lastIndex = ph.index;
      lastRemain = null;
      save();
      render();
    }

    const actions = {
      toggle() {
        if (running()) {
          state.acc = elapsedMs();
          state.startedAt = null;
        } else {
          if (elapsedMs() >= TOTAL * 1000) state.acc = 0;
          state.startedAt = Date.now();
          if (state.acc === 0) {
            lastIndex = 0;
            tone(660, 0.12, 0);
            tone(990, 0.3, 0.13);
          }
        }
        save();
        render();
      },
      prev() {
        const ph = phaseAt(elapsedMs() / 1000);
        const i = ph.done ? PROGRAM.length - 1 : ph.index;
        // 구간 시작 직후(3초 이내)면 이전 구간으로, 아니면 현재 구간 처음으로
        const target = ph.done || ph.into > 3 ? i : Math.max(0, i - 1);
        seekTo(STARTS[target]);
      },
      next() {
        const ph = phaseAt(elapsedMs() / 1000);
        if (ph.done) return;
        seekTo(ph.index + 1 < PROGRAM.length ? STARTS[ph.index + 1] : TOTAL);
      },
      reset() {
        state.acc = 0;
        state.startedAt = null;
        lastIndex = 0;
        lastRemain = null;
        save();
        render();
      },
      mute() {
        state.muted = !state.muted;
        save();
        render();
      },
      hide() {
        setVisible(false);
      },
    };

    function setVisible(v) {
      state.visible = v;
      save();
      root.hidden = !v;
    }

    // ---------- 렌더 ----------
    function render() {
      const elapsed = elapsedMs() / 1000;
      const ph = phaseAt(elapsed);

      if (ph.done) {
        if (running()) {
          state.acc = TOTAL * 1000;
          state.startedAt = null;
          save();
        }
        if (lastIndex !== null && lastIndex < PROGRAM.length) cuePhase('done');
        lastIndex = PROGRAM.length;
        root.dataset.kind = 'done';
        elTime.textContent = fmt(TOTAL);
        elLabel.textContent = 'FINISH';
        elSub.textContent = '30분 완료 · 수고하셨어요';
        elArc.style.strokeDasharray = CIRC + ' ' + CIRC;
      } else {
        const k = KINDS[ph.phase.kind];
        const remain = Math.ceil(ph.remaining - 1e-6);
        if (running()) {
          if (lastIndex !== null && ph.index !== lastIndex) cuePhase(ph.phase.kind);
          else if (remain !== lastRemain && remain >= 1 && remain <= 3) tone(remain === 1 ? 990 : 740, 0.12, 0, 0.22);
        }
        lastIndex = ph.index;
        lastRemain = remain;

        root.dataset.kind = ph.phase.kind;
        elTime.textContent = fmt(ph.remaining);
        elLabel.textContent = k.label;
        const nextP = PROGRAM[ph.index + 1];
        let sub = ph.index + 1 + '/' + PROGRAM.length;
        if (!running() && elapsed === 0) sub += ' · 원을 눌러 시작';
        else if (!running()) sub += ' · 일시정지';
        else if (nextP) sub += ' · 다음 ' + KINDS[nextP.kind].label + ' ' + fmtShort(nextP.sec);
        else sub += ' · 마지막 구간';
        elSub.textContent = sub;
        elArc.style.strokeDasharray = ph.frac * CIRC + ' ' + CIRC;
      }

      root.classList.toggle('is-running', running());
      root.classList.toggle('is-final', !ph.done && running() && ph.remaining <= 3);
      elPlay.innerHTML = icon(running() ? 'pause' : 'play');
      elPlay.setAttribute('aria-label', running() ? '일시정지' : '시작');
      elMute.innerHTML = icon(state.muted ? 'mute' : 'sound');
      elMute.setAttribute('aria-label', state.muted ? '소리 켜기' : '소리 끄기');
      root.hidden = !state.visible;

      relayout();
      const snap = { elapsed: Math.min(elapsed, TOTAL), index: ph.index, running: running(), done: ph.done };
      listeners.forEach((fn) => fn(snap));
    }

    // ---------- 배치 ----------
    let host = null;
    let layout = 'fill';
    const ro = global.ResizeObserver ? new ResizeObserver(() => relayout()) : null;

    function relayout() {
      if (!host) return;
      const W = host.clientWidth;
      const H = host.clientHeight;
      if (layout === 'video') {
        // 플레이어 안에서 실제 영상이 그려지는 영역을 기준으로 원본과 같은 위치에 둠
        const v = host.querySelector('video');
        const ar = v && v.videoWidth && v.videoHeight ? v.videoWidth / v.videoHeight : 16 / 9;
        let w = W, h = H, x = 0, y = 0;
        if (W / H > ar) { w = H * ar; x = (W - w) / 2; } else { h = W / ar; y = (H - h) / 2; }
        root.style.setProperty('--u', (h / 100).toFixed(3) + 'px');
        root.style.left = (x + w * 0.012).toFixed(1) + 'px';
        root.style.top = (y + h * 0.028).toFixed(1) + 'px';
      } else if (layout === 'fill') {
        root.style.setProperty('--u', Math.max(2, Math.min(W / 82, H / 34)).toFixed(3) + 'px');
      } else {
        root.style.setProperty('--u', '3.6px');
      }
    }

    function mount(target, mode) {
      host = target;
      layout = mode || 'fill';
      root.dataset.layout = layout;
      root.style.left = root.style.top = '';
      target.appendChild(root);
      if (ro) {
        ro.disconnect();
        ro.observe(target);
      }
      relayout();
    }

    // 다른 탭에서 조작한 내용 반영
    global.addEventListener('storage', (ev) => {
      if (ev.key !== opts.storageKey) return;
      load();
      lastIndex = null;
      render();
    });

    load();
    lastIndex = phaseAt(elapsedMs() / 1000).index;
    render();
    setInterval(render, 200);

    return {
      root,
      mount,
      get host() { return host; },
      get layout() { return layout; },
      toggleVisible() { setVisible(!state.visible); render(); },
      show() { setVisible(true); render(); },
      seekPhase(i) { ensureAudio(); seekTo(STARTS[i]); },
      action(name) { ensureAudio(); actions[name](); },
      onUpdate(fn) { listeners.push(fn); render(); },
      relayout,
    };
  }

  global.IntervalRide = { PROGRAM, KINDS, STARTS, TOTAL, fmt, fmtShort, create };
})(typeof window !== 'undefined' ? window : this);
