/* ============================================================
 * game-board.js —— 棋盤渲染與互動（經典／冒險共用）
 * 內容：初始化與死局檢測、render、點選＋拖曳選字、
 *       拼字規則切換（相鄰/任選）、目前單字計分預覽、
 *       蟲蟲台詞、Bonus Word（CEFR 分級）。
 * ============================================================ */

/* ================= 拼字規則切換（相鄰連線 / 全盤任選，經典模式限定） ================= */
function renderModeBtn() {
  document.getElementById('mode').textContent = easyMode ? '😌 任選拼字' : '🔗 相鄰拼字';
}
document.getElementById('mode').onclick = () => {
  easyMode = !easyMode;
  localStorage.setItem('wordworm_easymode', easyMode ? '1' : '0');
  renderModeBtn();
  sel = []; render(); updateCurrent();
  pickBonusWord();
  toast(easyMode ? '😌 任選拼字：整個棋盤的字母都能任意選！' : '🔗 相鄰拼字：只能連相鄰的字母', 2200);
};

/* ================= 初始化 ================= */
// 死局檢測：抽查 A1 常見字，可拼數太少代表爛盤
function boardPlayable() {
  let ok = 0;
  const sample = [...CEFR.a1].sort(() => Math.random() - .5).slice(0, 40);
  for (const w of sample) { if (canSpell(w)) ok++; if (ok >= 4) return true; }
  return false;
}
function freshBoard() {
  for (let tries = 0; tries < 6; tries++) {
    grid = [];
    grid = Array.from({length: COLS}, () => Array.from({length: ROWS}, newTile));
    ensureBoardVowelFloor(grid);
    if (boardPlayable()) return;
  }
}
function freshBoardAdventure() {
  for (let tries = 0; tries < 40; tries++) {
    const board = Array.from({length: COLS}, () => Array.from({length: ROWS}, () => null));
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        board[c][r] = newTileAdventure(board);
      }
    }
    grid = board;
    if (adventureBoardBalanced(grid) && boardPlayable()) return;
  }
}
function init(fromSave = false) {
  setBgmTheme('classic');
  if (!fromSave || !loadGame()) {
    localStorage.removeItem(SAVE_KEY);
    freshBoard();
    sel = []; score = 0; wordCount = 0; bestWord = ''; bestWordScore = 0;
    weakStreak = 0; level = 1;
  }
  sel = []; over = false; burnPhase = 0;
  document.getElementById('gameover').classList.remove('show');
  setFace('normal'); renderModeBtn();
  if (DICT) pickBonusWord();
  render(); updateHud(); checkLevelUp();
  if (fromSave && score > 0) toast('讀取存檔，歡迎回來 🐛', 1600);
}

/* ================= 相鄰判定（整齊方格、含斜角 8 方向） ================= */
let easyMode = localStorage.getItem('wordworm_easymode') === '1';
function adjacent(a, b) {
  if (gameMode === 'adventure' || gameMode === 'daily' || easyMode) return !(a.c === b.c && a.r === b.r);  // 冒險／每日／輕鬆模式：全盤任選
  const dc = Math.abs(b.c - a.c), dr = Math.abs(b.r - a.r);
  return dc <= 1 && dr <= 1 && (dc + dr > 0);
}

/* ================= 渲染 ================= */
function render() {
  boardEl.innerHTML = '';
  for (let c = 0; c < COLS; c++) {
    const colEl = document.createElement('div');
    colEl.className = 'col';
    for (let r = 0; r < ROWS; r++) {
      const t = grid[c][r];
      const el = document.createElement('div');
      el.className = 'tile';
      if (t.burning) el.classList.add('burning');
      if (t.gem) el.classList.add('gem-' + t.gem);
      if (t.locked) el.classList.add('locked');
      if (t.cursed) el.classList.add('cursed');
      if (t.used) el.classList.add('used');    // 每日挑戰的洞（磚用掉不補）；經典／冒險的磚沒有這個欄位
      if (t.fresh) { el.classList.add('falling'); t.fresh = false; }
      if (sel.some(s => s.c === c && s.r === r)) el.classList.add('sel');
      el.textContent = t.letter;
      if (isNegativeTile(t)) {
        const count = document.createElement('span');
        count.className = 'tile-status-count';
        count.textContent = negativeTileTurns(t);
        count.title = '剩餘 ' + negativeTileTurns(t) + ' 次有效攻擊後解除';
        el.appendChild(count);
      }
      el.dataset.c = c; el.dataset.r = r;
      colEl.appendChild(el);
    }
    boardEl.appendChild(colEl);
  }
}

/* ================= 選字互動（點選 + 拖曳） ================= */
let dragging = false;
function tileAt(x, y) {
  const el = document.elementFromPoint(x, y);
  const tile = el && el.closest ? el.closest('.tile') : null;
  return tile && boardEl.contains(tile) ? { c: +tile.dataset.c, r: +tile.dataset.r } : null;
}
function pick(p) {
  if (over || !p) return;
  if (grid[p.c][p.r].locked || grid[p.c][p.r].used) return;  // 鎖定磚（冒險技能）與洞（每日消磚）不可選取
  const i = sel.findIndex(s => s.c === p.c && s.r === p.r);
  if (i !== -1) {
    if (i === sel.length - 2 && dragging) sel.pop();      // 拖回上一格 = 反悔
    else if (!dragging) sel = sel.slice(0, i);            // 點已選的 = 截斷到該處之前
  } else if (sel.length === 0 || adjacent(sel[sel.length - 1], p)) {
    sel.push(p);
    sfx.pick(sel.length);
  } else if (!dragging) {
    sel = [p];                                            // 點不相鄰的 = 重新開始選
  }
  render(); updateCurrent();
}
boardEl.addEventListener('pointerdown', e => { dragging = true; pick(tileAt(e.clientX, e.clientY)); });
boardEl.addEventListener('pointermove', e => { if (dragging) pick(tileAt(e.clientX, e.clientY)); });
window.addEventListener('pointerup', () => { dragging = false; });

/* ================= 目前單字與計分 ================= */
function currentWord() { return sel.map(s => grid[s.c][s.r].letter).join(''); }
function wordScore(word, tiles) {
  let base = 0;
  for (const ch of word.toUpperCase()) base += LETTER_SCORE[ch] || 0;
  // 長度加成：4字x1.5、5字x2、6字x3、7+字x4（取整）
  const L = word.length;
  const mult = L >= 7 ? 4 : L >= 6 ? 3 : L >= 5 ? 2 : L >= 4 ? 1.5 : 1;
  let s = Math.round(base * mult * 10);
  // 寶石加成
  for (const p of tiles) {
    const g = grid[p.c][p.r].gem;
    if (g === 'green') s += 100;
    if (g === 'gold') s += 250;
    if (g === 'sapphire') s += 500;
    if (g === 'diamond') s += 1000;
  }
  return s;
}
function updateCurrent() {
  if (gameMode === 'daily') { updateCurrentDaily(); return; }  // 每日模式用自己的計分預覽（js/daily.js）
  if (gameMode === 'kids') return;
  const w = currentWord();
  const cur = document.getElementById('current');
  if (!w) {
    cur.innerHTML = '&nbsp;';
    if (gameMode === 'adventure') renderAdvFloatingWord();
    return;
  }
  const valid = DICT && DICT.has(w.toLowerCase());
  cur.classList.toggle('invalid', !valid);
  cur.innerHTML = w + (valid ? ' <span class="score-preview">+' + wordScore(w, sel) + '</span>' : '');
  if (gameMode === 'adventure') renderAdvFloatingWord();
}


/* ================= 蟲蟲台詞 ================= */
const QUIPS = {
  short: ['嗯⋯⋯這樣也算啦', '三個字母？我牙縫都塞不滿🐛', '小菜。真的很小。', '好，暖身而已對吧？', '省著點拼，燃燒磚在看著你喔'],
  mid: ['不錯嘛，有在動腦！', '嗯嗯，這個有書卷味了', '好吃好吃🐛', '及格！繼續保持', '我開始對你有點期待了'],
  long: ['哇喔！！這個字我要裱框！', '你的字彙量是吃字典長大的嗎！', '太漂亮了，我要感動落淚🥹', '這就是傳說中的高手嗎', '請收下書蟲的膝蓋（如果我有的話）'],
  bad: ['呃，這個字典裡沒有耶', '你發明新單字了嗎？很有創意但不行', '嗯？拼歪了拼歪了', '我讀過十七萬個字，沒看過這個🐛'],
  bonus: ['🎊 Bonus Word！！你抓到了！', '獎勵單字達成！今天的你發光了✨']
};
const quip = arr => arr[Math.floor(Math.random() * arr.length)];
function speechBubble(msg, ms = 2000) {
  const b = document.getElementById('speech-bubble');
  b.textContent = msg; b.classList.add('show');
  clearTimeout(b._h); b._h = setTimeout(() => b.classList.remove('show'), ms);
}
const bubble = msg => speechBubble(msg);

/* ================= Bonus Word（CEFR 分級 + 棋盤可拼保底） ================= */
// 依等級出題：Lv1-2 A1、Lv3-4 A2、Lv5-6 B1、Lv7-8 B2、Lv9+ 完整字典
const CEFR = {
  a1: ['cat','dog','sun','rain','book','food','milk','fish','bird','tree','door','hand','head','blue','red','green','girl','boy','name','game','play','read','walk','talk','eat','swim','love','like','good','nice','big','small','old','new','hot','cold','day','night','week','year','home','room','bed','desk','pen','cup','egg','tea','rice','meat','ball','shoe','hat','bag','bus','car','map','sea','sky','star','moon','baby','mom','dad','one','two','ten','leg','arm','eye','ear','nose','face','hair','water','apple','happy','table','chair','house','sleep','smile','dance','sing','run','jump','open','stop','help','look','find','give','take','make','come','know'],
  a2: ['angry','beach','bread','bridge','carry','catch','cloud','dream','drive','early','earth','field','fight','floor','fruit','glass','grass','heavy','horse','hotel','island','knife','laugh','learn','light','lucky','money','month','mouth','music','party','plant','pocket','quiet','river','round','sharp','shirt','short','smart','snake','sound','space','sport','stone','store','storm','story','sugar','sweet','teach','thick','thin','tired','tooth','town','train','uncle','visit','voice','wait','wall','warm','wash','watch','wear','wind','winter','worry','write','wrong','young','clean','clever','close','cook','corner','count','cross','crowd','dance','dinner','dirty','doctor','double','draw','dress','drink','drop'],
  b1: ['ability','absence','account','achieve','advance','advice','afford','amount','ancient','announce','annual','anxious','appear','approve','arrange','arrival','article','attempt','attract','average','balance','battery','behave','belief','belong','benefit','border','breath','brief','burden','calm','campaign','capable','capture','career','careful','castle','casual','cause','celebrate','century','certain','chain','challenge','chance','channel','chapter','charge','charity','chase','cheap','check','cheerful','choice','citizen','claim','climate','collect','college','combine','comfort','comment','common','compare','compete','complain','complete','concern','confirm','connect','consider','contain','contest','continue','control','convince','correct','courage','create','culture','curious','current','custom','damage','danger','decade','decide','declare','defend','degree','deliver','demand'],
  b2: ['abandon','absorb','abstract','abundant','accompany','accurate','acquire','adequate','adjacent','advocate','aesthetic','aggregate','ambiguous','ambitious','analyse','anticipate','apparent','appetite','appliance','appropriate','arbitrary','articulate','assemble','assess','asset','assume','assure','attain','attribute','authentic','autonomy','barrier','bearing','bias','bond','boost','breach','browse','bulk','bureau','capacity','ceiling','cite','clarify','coherent','coincide','collapse','commence','commodity','compatible','compel','compensate','competent','compile','complement','component','compound','comprise','conceive','concept','concise','conduct','confine','conflict','conform','confront','consent','conserve','consist','constant','constitute','constrain','construct','consult','consume','contempt','contract','contrary','contrast','contribute','convert','convey','cope','crucial','cultivate','decline','dedicate','deduce','defect','deficit','denote','depict','deprive','derive','designate','deteriorate']
};
let bonusWord = '';
function cefrPool() {
  if (level <= 2) return CEFR.a1;
  if (level <= 4) return CEFR.a2;
  if (level <= 6) return CEFR.b1;
  if (level <= 8) return CEFR.b2;
  return null; // Lv9+ 用完整字典
}
// 檢查棋盤能否拼出 word：經典模式=DFS 相鄰路徑；輕鬆模式=字母庫存數量足夠
function canSpell(word) {
  const W = word.toUpperCase().replace(/QU/g, 'Q');  // Qu 磚以 Q 代表
  const letterAt = (c, r) => grid[c][r].letter === 'Qu' ? 'Q' : grid[c][r].letter;
  if (gameMode === 'adventure' || easyMode) {
    const stock = {};
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++)
      stock[letterAt(c, r)] = (stock[letterAt(c, r)] || 0) + 1;
    const need = {};
    for (const ch of W) need[ch] = (need[ch] || 0) + 1;
    return Object.entries(need).every(([ch, n]) => (stock[ch] || 0) >= n);
  }
  const dfs = (i, c, r, used) => {
    if (letterAt(c, r) !== W[i]) return false;
    if (i === W.length - 1) return true;
    used.add(c * 100 + r);
    for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) {
      if (!dc && !dr) continue;
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
      if (used.has(nc * 100 + nr)) continue;
      if (dfs(i + 1, nc, nr, used)) { used.delete(c * 100 + r); return true; }
    }
    used.delete(c * 100 + r);
    return false;
  };
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++)
    if (dfs(0, c, r, new Set())) return true;
  return false;
}
function pickBonusWord() {
  if (!DICT) return;
  const pool = cefrPool() || [...DICT].filter(w => w.length >= 4 && w.length <= 6);
  // 隨機挑，直到找到棋盤真的拼得出來的字（保底：試 200 次後放寬到任何可拼字典字）
  const shuffled = [...pool].sort(() => Math.random() - .5);
  for (const w of shuffled.slice(0, 200)) {
    if (w.length >= 3 && DICT.has(w.toLowerCase()) && canSpell(w)) {
      bonusWord = w.toUpperCase();
      document.getElementById('bonusword').textContent = bonusWord;
      return;
    }
  }
  bonusWord = '';
  document.getElementById('bonusword').textContent = '—';
}
// 棋盤變動後檢查目前題目是否仍可拼，不行就換題
function revalidateBonus() {
  if (bonusWord && !canSpell(bonusWord)) pickBonusWord();
}

