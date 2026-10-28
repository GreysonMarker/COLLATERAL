// Keep display controls usable even if the WebGL game cannot start.
const root = document.documentElement;
const buttons = ['fullscreen', 'fullscreen-quick'].map(id => document.getElementById(id));
const openQuick = document.getElementById('open-game-quick');
const notice = document.getElementById('display-notice');
const request = root.requestFullscreen || root.webkitRequestFullscreen;
const allowed = Boolean(request && (document.fullscreenEnabled ?? document.webkitFullscreenEnabled ?? true));
const active = () => document.fullscreenElement || document.webkitFullscreenElement;
let noticeTimer;
function fallback() {
  openQuick.hidden = false;
  notice.textContent = 'Fullscreen is unavailable here. Tap OPEN GAME ↗ to play in its own tab.';
  notice.hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { notice.hidden = true; }, 8000);
}
function update() {
  const isFull = Boolean(active());
  buttons[0].textContent = isFull ? 'Exit fullscreen' : 'Fullscreen';
  for (const button of buttons) {
    button.setAttribute('aria-label', isFull ? 'Exit fullscreen' : 'Enter fullscreen');
    button.setAttribute('aria-pressed', String(isFull));
  }
  buttons[1].title = isFull ? 'Exit fullscreen' : 'Fullscreen';
  window.dispatchEvent(new Event('resize'));
}
for (const button of buttons) {
  button.addEventListener('click', async () => {
    if (!allowed) { fallback(); return; }
    try {
      if (active()) {
        await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      } else {
        await request.call(root);
      }
      update();
    } catch { fallback(); }
  });
}
document.addEventListener('fullscreenchange', update);
document.addEventListener('webkitfullscreenchange', update);
openQuick.hidden = allowed;
