// 확장 아이콘(또는 Alt+Shift+T)을 누르면 현재 YouTube 탭의 타이머를 보이기/숨기기
chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) return;
  chrome.tabs.sendMessage(tab.id, { type: 'interval-ride:toggle' }).catch(() => {
    // YouTube 탭이 아니면 단독 타이머 페이지를 엶
    chrome.tabs.create({ url: chrome.runtime.getURL('timer.html') });
  });
});
