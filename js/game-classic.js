/* ============================================================
 * game-classic.js —— 拼字提交與經典模式核心
 * 內容：submit()（依模式分派的 dispatcher）、submitClassic、
 *       磚塊移除/掉落補充、燃燒磚、HUD 更新、遊戲結束。
 * ⚠️ submitClassic 與燃燒磚是 v1 以來的經典玩法核心，
 * 冒險模式的改動不應該碰這個檔案。
 * ============================================================ */

async function submit() {
  if (over) return;
  const w = currentWord();
  // Boggle 慣例：Qu 磚貢獻 Q+U 兩個字母；這裡檢查的是字母數，不是磚數。
  if (w.length < 3) { toast('至少 3 個字母'); return; }
  if (!DICT) {
    try { await ensureDictionaryLoaded(); }
    catch (e) { return; }
  }
  if (!DICT.has(w.toLowerCase())) { sfx.bad(); setFace('sad'); bubble(quip(QUIPS.bad)); shake();
    setTimeout(() => setFace('normal'), 1200); return; }
  if (gameMode === 'adventure') { submitAdventure(w); return; }
  if (gameMode === 'daily') { submitDaily(w); return; }  // 每日挑戰計分（js/daily.js）
  submitClassic(w);
}

function submitClassic(w) {
  let s = wordScore(w, sel);
  const isBonus = w.toUpperCase() === bonusWord;
  if (isBonus) s *= 3;
  score += s; wordCount++;
  if (s > bestWordScore) { bestWordScore = s; bestWord = w; }

  sfx.ok(w.length); setFace('happy');
  const face = document.getElementById('wormface');
  face.style.transform = 'scale(1.25)'; setTimeout(() => face.style.transform = '', 250);

  if (isBonus) { toast('🎊 BONUS ×3！+' + s, 2000); setTimeout(() => bubble(quip(QUIPS.bonus)), 800); pickBonusWord(); }
  else {
    toast('+' + s + '　' + praise(w.length), 1100);
    if (Math.random() < .45) setTimeout(() => bubble(quip(w.length <= 3 ? QUIPS.short : w.length <= 5 ? QUIPS.mid : QUIPS.long)), 900);
  }

  // 燃燒磚壓力：短字累積、長字洩壓
  if (w.length <= 3) weakStreak++;
  else if (w.length >= 5) weakStreak = Math.max(0, weakStreak - 2);
  const gemTier = isBonus ? 'diamond' : w.length >= 8 ? 'diamond' : w.length >= 7 ? 'sapphire' : w.length >= 6 ? 'gold' : w.length >= 5 ? 'green' : null;

  removeTiles(sel, gemTier);
  sel = [];
  /* 難度曲線：
     Lv1-2 蜜月期＝不生燃燒磚、不燒；
     Lv3-4 慢速期＝燃燒磚每 2 次提交才下沉一格；
     Lv5+ 正常＋隨等級遞增 */
  if (level >= 3) {
    burnPhase++;
    if (level >= 5 || burnPhase % 2 === 0) advanceBurning();
    const streakLimit = Math.max(2, 5 - Math.floor(level / 4));
    if (weakStreak >= streakLimit) { spawnBurning(); weakStreak = 0; }
    else if (level >= 5 && Math.random() < (level - 4) * 0.015) spawnBurning();
  }
  revalidateBonus();
  render(); updateCurrent(); updateHud();
  checkLevelUp();
  saveGame();
  checkOver();
}

function praise(L) {
  return L >= 8 ? '傳說單字！💎' : L >= 7 ? '藍寶石級！' : L >= 6 ? '黃金單字！' : L >= 5 ? '漂亮！' : '不錯！';
}
function shake() {
  boardEl.animate([{transform:'translateX(0)'},{transform:'translateX(-6px)'},{transform:'translateX(6px)'},{transform:'translateX(0)'}], {duration:200});
}

/* ================= 磚塊移除 / 掉落補充 ================= */
function removeTiles(tiles, gemTier) {
  // 依欄分組，由該欄底部往上壓縮
  const byCol = {};
  for (const p of tiles) (byCol[p.c] ||= []).push(p.r);
  let gemPlaced = !gemTier;
  for (const c in byCol) {
    const col = grid[c];
    const remove = new Set(byCol[c]);
    const kept = col.filter((_, r) => !remove.has(r));
    const need = ROWS - kept.length;
    const fresh = Array.from({length: need}, newTile);
    if (!gemPlaced && fresh.length) { fresh[0].gem = gemTier; gemPlaced = true; }
    grid[c] = [...fresh, ...kept];
  }
}
// 冒險模式：拼掉的磚原地生成新磚（不做欄位掉落壓縮，棋盤形狀固定 4×4）
function removeTilesAdventure(tiles, gemTier) {
  let gemPlaced = !gemTier;
  for (const p of tiles) grid[p.c][p.r] = null;
  for (const p of tiles) {
    const t = newTileAdventure();
    if (!gemPlaced) { t.gem = gemTier; gemPlaced = true; }
    grid[p.c][p.r] = t;
  }
}

/* ================= 燃燒磚 ================= */
function spawnBurning() {
  const c = Math.floor(Math.random() * COLS);
  grid[c][0].burning = true;
  sfx.burn();
  toast('🔥 燃燒磚出現了！拼長一點的字！', 1600);
}
function advanceBurning() {
  // 每次提交後，所有燃燒磚往下燒一格（把下面那格變燃燒，自己熄滅成新磚）
  const moves = [];
  for (let c = 0; c < COLS; c++)
    for (let r = ROWS - 1; r >= 0; r--)
      if (grid[c][r].burning) moves.push({c, r});
  for (const {c, r} of moves) {
    if (r === ROWS - 1) { over = true; return; }  // 燒到底
    grid[c][r] = newTile();
    grid[c][r + 1].burning = true;
  }
}
function shuffle() {
  if (over) return;
  // 洗牌代價：生成一顆燃燒磚（原版精神：躲避是有代價的）
  const letters = [];
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) letters.push(grid[c][r]);
  for (let i = letters.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [letters[i], letters[j]] = [letters[j], letters[i]];
  }
  let i = 0;
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) grid[c][r] = letters[i++];
  sel = [];
  if (level >= 3) spawnBurning();
  else toast('洗好了～（Lv.3 之後洗牌會有燃燒磚代價喔）', 1800);
  revalidateBonus();
  render(); updateCurrent();
  saveGame();
}

/* ================= HUD / 結束 ================= */
function updateHud() {
  document.getElementById('score').textContent = score.toLocaleString();
  document.getElementById('wordcount').textContent = wordCount;
  document.getElementById('bestword').textContent = bestWord || '—';
}
function checkOver() {
  if (!over) return;
  sfx.over(); setFace('sad');
  localStorage.removeItem(SAVE_KEY);
  const hi = hiScore();
  if (score > hi) { localStorage.setItem(HI_KEY, score); }
  document.getElementById('fhiscore').textContent =
    score > hi ? '🎉 新紀錄！' : '歷史最高：' + hi.toLocaleString();
  document.getElementById('flevel').textContent = level;
  document.getElementById('frank').textContent = rankTitle();
  document.getElementById('fscore').textContent = score.toLocaleString();
  document.getElementById('fwords').textContent = wordCount;
  document.getElementById('fbest').textContent = bestWord || '—';
  document.getElementById('gameover').classList.add('show');
}
