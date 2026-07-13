/* ============================================================
 * game-boot.js —— 開機檔（必須是最後一個 game 檔）
 * 內容：字典下載啟動、跨模組共用按鈕繫結、程式進入點。
 * 為什麼存在：不同 <script> 檔之間函式宣告不會互相提升，
 * 「直接引用別檔函式名」的頂層程式碼全部收攏到這裡、
 * 排在最後載入，就永遠不會踩到還沒定義的函式。
 * 以後要加跨檔的頂層呼叫，一律加在這個檔案。
 * ============================================================ */

/* ================= 拼字提交 ================= */
document.getElementById('submit').onclick = submit;
document.getElementById('clear').onclick = () => { sel = []; render(); updateCurrent(); };
document.getElementById('shuffle').onclick = shuffle;
document.getElementById('restart').onclick = init;
document.getElementById('modesel-classic').onclick = () => selectGameMode('classic');
document.getElementById('modesel-adventure').onclick = () => selectGameMode('adventure');
document.getElementById('modesel-daily').onclick = () => selectGameMode('daily');
document.getElementById('modesel-kids').onclick = () => selectGameMode('kids');
document.getElementById('home-return').onclick = returnHome;
document.getElementById('classic-home').onclick = returnHome;
document.getElementById('adv-home').onclick = returnHome;

function closeMoreMenu() {
  const panel = document.getElementById('more-menu-panel');
  const toggle = document.getElementById('more-toggle');
  if (!panel || !toggle) return;
  panel.hidden = true;
  toggle.setAttribute('aria-expanded', 'false');
}
document.getElementById('more-toggle').onclick = e => {
  e.stopPropagation();
  const panel = document.getElementById('more-menu-panel');
  const toggle = document.getElementById('more-toggle');
  const willOpen = panel.hidden;
  panel.hidden = !willOpen;
  toggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
};
document.getElementById('more-menu-panel').onclick = e => {
  if (e.target.closest('.more-menu-item')) closeMoreMenu();
};
document.addEventListener('click', e => {
  if (!e.target.closest('#more-menu')) closeMoreMenu();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeMoreMenu();
});

/* ================= 測試開關 ================= */
function shouldShowDebugWinScreen() {
  try {
    return new URLSearchParams(window.location.search).get('debug') === 'win';
  } catch {
    return false;
  }
}

function showDebugWinScreen() {
  gameMode = 'adventure';
  applyModeClass();
  setBoardSize();
  initAdventure(true);
  document.body.classList.remove('home-screen');
  openAdventureEnding(() => returnHome());
}

/* ================= 程式進入點 ================= */
setBoardSize();
applyModeClass();
if (gameMode === 'adventure') initAdventure(true);
else if (gameMode === 'daily') initDaily(true);  // initDaily 定義在 js/daily.js（載入順序在本檔之前）
else if (gameMode === 'kids') {
  // js/kids.js 載入在本檔之後；保留小書蟲模式狀態，讓 kids.js 接手初始化。
}
else init(true);
if (shouldShowDebugWinScreen()) showDebugWinScreen();
