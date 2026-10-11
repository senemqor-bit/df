// 단독 타이머 페이지: 큰 타이머, 운동 프로필, 구간 목록, 작은 창(항상 위) 띄우기
(function () {
  'use strict';
  const { PROGRAM, KINDS, STARTS, TOTAL, fmtShort, create } = window.IntervalRide;

  const stage = document.getElementById('stage');
  const stageNote = document.getElementById('stage-note');
  const profile = document.getElementById('profile');
  const axis = document.getElementById('axis');
  const list = document.getElementById('list');
  const pipBtn = document.getElementById('pip-btn');

  const ui = create({ storageKey: 'intervalRide.page.v1' });
  ui.mount(stage, 'fill');

  // 운동 프로필
  const segs = PROGRAM.map((p, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'seg';
    b.style.flex = p.sec + ' 1 0';
    b.title = KINDS[p.kind].label + ' ' + fmtShort(p.sec);
    b.setAttribute('aria-label', i + 1 + '번째 구간 ' + KINDS[p.kind].ko + ' ' + fmtShort(p.sec) + '로 이동');
    const bar = document.createElement('i');
    bar.style.height = KINDS[p.kind].level * 100 + '%';
    bar.style.background = KINDS[p.kind].color;
    b.appendChild(bar);
    b.addEventListener('click', () => ui.seekPhase(i));
    profile.appendChild(b);
    return b;
  });
  const playhead = document.createElement('div');
  playhead.className = 'playhead';
  profile.appendChild(playhead);

  for (let m = 0; m <= TOTAL / 60; m += 5) {
    const s = document.createElement('span');
    s.style.left = (m * 60 / TOTAL) * 100 + '%';
    s.textContent = m + '분';
    axis.appendChild(s);
  }

  // 구간 목록
  const rows = PROGRAM.map((p, i) => {
    const k = KINDS[p.kind];
    const li = document.createElement('li');
    li.innerHTML =
      '<button type="button">' +
        '<span class="at">' + fmtShort(STARTS[i]) + '</span>' +
        '<span class="name k-' + p.kind + '">' + k.label + '<small>' + k.ko + '</small></span>' +
        '<span class="dur">' + fmtShort(p.sec) + '</span>' +
      '</button>';
    li.firstChild.addEventListener('click', () => ui.seekPhase(i));
    list.appendChild(li);
    return li;
  });

  ui.onUpdate((s) => {
    playhead.style.left = 'calc(' + (s.elapsed / TOTAL) * 100 + '% - 1px)';
    segs.forEach((el, i) => {
      el.classList.toggle('is-now', i === s.index);
      el.classList.toggle('is-past', i < s.index);
    });
    rows.forEach((el, i) => {
      el.classList.toggle('is-now', i === s.index);
      el.classList.toggle('is-past', i < s.index);
    });
  });

  // 작은 창(Document Picture-in-Picture): 다른 창·탭 위에 항상 떠 있음. Chrome/Edge/Whale 데스크톱 지원
  let pipWin = null;
  if ('documentPictureInPicture' in window && window.top === window) {
    pipBtn.hidden = false;
    document.getElementById('pip-help').textContent =
      '작은 창으로 띄우면 다른 탭이나 앱에서 영상을 보는 동안에도 타이머가 화면 위에 떠 있습니다. 창 크기는 자유롭게 조절할 수 있습니다.';
  }

  pipBtn.addEventListener('click', async () => {
    if (pipWin) { pipWin.close(); return; }
    try {
      pipWin = await documentPictureInPicture.requestWindow({ width: 420, height: 170 });
    } catch (e) {
      return;
    }
    for (const sheet of document.styleSheets) {
      try {
        const style = pipWin.document.createElement('style');
        style.textContent = Array.from(sheet.cssRules, (r) => r.cssText).join('\n');
        pipWin.document.head.appendChild(style);
      } catch (e) {
        if (sheet.href) {
          const link = pipWin.document.createElement('link');
          link.rel = 'stylesheet';
          link.href = sheet.href;
          pipWin.document.head.appendChild(link);
        }
      }
    }
    pipWin.document.title = 'Interval Ride';
    pipWin.document.body.className = 'pip';
    ui.mount(pipWin.document.body, 'fill');
    pipWin.addEventListener('resize', ui.relayout);
    stageNote.hidden = false;
    pipBtn.textContent = '작은 창 닫기';
    pipWin.addEventListener('pagehide', () => {
      pipWin = null;
      ui.mount(stage, 'fill');
      stageNote.hidden = true;
      pipBtn.textContent = '작은 창으로 띄우기';
    });
  });

  // 키보드: 스페이스 = 시작/정지, ← → = 구간 이동
  document.addEventListener('keydown', (ev) => {
    if (ev.target.closest('button, input, textarea')) return;
    if (ev.code === 'Space') { ev.preventDefault(); ui.action('toggle'); }
    else if (ev.code === 'ArrowRight') ui.action('next');
    else if (ev.code === 'ArrowLeft') ui.action('prev');
  });

  // 화면 꺼짐 방지(지원 브라우저에서만)
  async function keepAwake() {
    try { if (navigator.wakeLock && document.visibilityState === 'visible') await navigator.wakeLock.request('screen'); } catch (e) { /* 무시 */ }
  }
  keepAwake();
  document.addEventListener('visibilitychange', keepAwake);
})();
