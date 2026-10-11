// YouTube 페이지에 타이머를 붙입니다. YouTube는 페이지 이동 시 플레이어를 다시 만들 수 있어 1초마다 위치를 확인합니다.
(function () {
  'use strict';
  if (window.__intervalRideLoaded) return;
  window.__intervalRideLoaded = true;

  const ui = IntervalRide.create({ storageKey: 'intervalRide.v1', closable: true });

  function findPlayer() {
    const candidates = [
      document.querySelector('#movie_player'),
      document.querySelector('#player-container-id .html5-video-player'),
      document.querySelector('.html5-video-player'),
    ];
    return candidates.find((p) => p && p.offsetWidth > 0 && p.offsetHeight > 0) || null;
  }

  function attach() {
    const player = findPlayer();
    const host = player || document.body;
    const mode = player ? 'video' : 'fixed';
    if (ui.host !== host || ui.layout !== mode || !host.contains(ui.root)) ui.mount(host, mode);
  }

  attach();
  setInterval(attach, 1000);
  document.addEventListener('fullscreenchange', () => setTimeout(() => { attach(); ui.relayout(); }, 50));

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'interval-ride:toggle') ui.toggleVisible();
  });
})();
