
Promise.all([
  fetchTextAsset('enable1.txt', { required: true }),
  fetchTextAsset('modern-words.txt').catch(() => ''),
  fetchTextAsset('extra-words.txt').catch(() => ''),
]).then(([coreText, modernText, extraText]) => {
  const coreWords = dictionaryWordsFromText(coreText);
  if (!coreWords.length) throw new Error('enable1.txt parsed 0 words');
  const coreSet = new Set(coreWords);
  const modernWords = dictionaryWordsFromText(modernText);
  const extraWords = dictionaryWordsFromText(extraText);
  const supplementalWords = [...modernWords, ...extraWords];
  const supplementalSet = new Set(supplementalWords);
  const extraAdded = [...supplementalSet].filter(w => !coreSet.has(w)).length;
  DICT = new Set([...coreWords, ...supplementalWords]);
  toast('字典就緒，開拼！(' + DICT.size.toLocaleString() + ' 字，補充 ' + extraAdded.toLocaleString() + ' 字)');
  if (!bonusWord) pickBonusWord();
}).catch(error => {
  console.error('Dictionary load failed:', error);
  toast('字典載入失敗，請重新整理', 4000);
});
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

/* ================= 程式進入點 ================= */
setBoardSize();
applyModeClass();
if (gameMode === 'adventure') initAdventure(true);
else if (gameMode === 'daily') initDaily(true);  // initDaily 定義在 js/daily.js（載入順序在本檔之前）
else if (gameMode === 'kids') {
  // js/kids.js 載入在本檔之後；保留小書蟲模式狀態，讓 kids.js 接手初始化。
}
else init(true);
