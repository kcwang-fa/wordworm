# Word Worm Codebase 技術摘要（給接手 AI）

寫給要接手「冒險模式 UI 重做（BWA 版面）／冒險地圖／UI 設計」這三項的 AI。這三項原本規劃自己施工，童童決定改成 Vickie 自己的 AI 接手，這份文件是原開發者（dev）整理的現況地圖，不含需求規格（需求規格另有文件）。

## 檔案結構

> 2026-07-12 重構：原單檔已拆分為多檔（零建置原則不變，仍是多個 `<script>`/`<link>` 標籤＋全域函式，沒有 bundler、沒有 ES modules）。本文件其餘段落引用的「index.html 行號」是拆分前的舊行號，函式說明仍然有效，找程式碼請改用下面的檔案對照。

- `index.html`：HTML 骨架＋Service Worker 註冊
- `css/`：六檔，載入順序＝cascade 順序（見 index.html）——`base.css`（:root 變數、首頁）、`adventure.css`、`board.css`、`gameover.css`、`daily-kids.css`（兩模式因 `#mode-select` 順序相依合檔，勿拆）、`word-of-day.css`
- `js/` game 系列九檔，載入順序有依賴（core 最先、boot 最後，各檔檔頭有職責說明）：`game-core.js`（共用狀態/字典工具/計分/棋盤生成）、`game-audio.js`、`game-save.js`（所有 localStorage key 集中於此）、`game-board.js`（渲染/互動）、`game-classic.js`（submit dispatcher＋經典核心）、`game-adventure.js`（戰鬥層）、`game-adventure-map.js`（地圖/故事/流程）、`game-sync.js`、`game-boot.js`（跨模組繫結與進入點）
- `js/` 其他：`story.js`（故事文本）、`adventure-data.js`（關卡資料）、`daily.js`（每日挑戰，須在 game 檔前載入）、`kids.js`、`word-of-day.js`
- `sw.js`：PWA 快取。**PRECACHE_URLS 硬編碼檔名＋版本，拆檔/改版時必須與 index.html 標籤逐字元同步**，任一條 404 會讓整批快取安裝失敗
- **零建置、零外部資源**（無 CDN、無外部圖片/字型/JS 套件）
- `enable1.txt`：ENABLE1 核心英文字典（172,727 字，public domain）
- `modern-words.txt`：ESDB / SCOWL `en_US` 現代補充字表，只收 lowercase ASCII、3+ 字母、且 ENABLE1 沒有的字
- `extra-words.txt`：人工補充例外字，例如國籍/語言形容詞或產品需要接受的現代詞
- 沒有 package.json、沒有 build 工具、沒有其他原始檔

本地測試：因為字典用 `fetch()` 載入，**不能直接用 `file://` 開**（CORS 擋），要起本地 HTTP server，例如：
```
python -m http.server 8791
```
再開 `http://127.0.0.1:8791/index.html`。

部署：GitHub Pages，repo `Tsun-u/tsunu-wordworm`，main branch root，push 後自動 build（通常 1-2 分鐘）。驗證用 `?t=亂數` 破快取。

## 整體架構

原生 JS，無框架。全域變數 + 函式，沒有 class/module。

- `gameMode`：`'classic'` | `'adventure'`，存在 `localStorage['wordworm_gamemode']`，決定大部分行為分支
- `COLS`/`ROWS`：依模式動態設定（`setBoardSize()`，index.html:410）——經典 7×7、冒險 4×4
- `grid[c][r]`：二維陣列存棋盤，tile 物件形狀：`{ letter, burning, gem, locked, cursed, fresh }`
  - `burning`/`gem` 是經典模式用（燃燒磚/寶石磚）
  - `locked`/`cursed` 是冒險模式用（鎖定磚不可選／詛咒磚拼中減傷），經典模式的 tile 永遠不會有這兩個欄位為 true
- `body` 有 `mode-classic`/`mode-adventure` class（`applyModeClass()`, index.html:414），CSS 靠這個 class 切換經典/冒險各自的 HUD 區塊顯示/隱藏
- 兩模式共用：`render()`（棋盤渲染, 672）、`pick()`（選字互動, 701）、`adjacent()`（相鄰判定, 665，冒險模式固定全盤任選）、`newTile()`（生磚, 483）

## 冒險模式關鍵函式與狀態流（這次要重做的核心）

**全域狀態** `adv`（index.html:995）：
```js
{ chapterIdx, monsterIdx, playerHp, playerMaxHp, monsterHp, monsterMaxHp,
  monsterAtk, monsterName, monsterKind, isBoss, totalKills }
```

**資料**（988 行附近）：
- `MONSTER_TEMPLATES`：章節陣列，每章是怪物陣列，每隻怪 `{name, hp, atk, kind, boss?}`。**目前只有 1 章 3 隻怪**（紙頁鼠→墨漬怪→蛀書蟲王Boss），沒有「地圖」概念的資料結構，要做冒險地圖等於從零設計
- `CHAPTER_TITLES`：章節標題陣列

**流程**（一次拼字攻擊的完整路徑）：
1. `submit()`（838）是 dispatcher：檢查字數/字典，通過後依 `gameMode` 分派到 `submitClassic(w)`（849，經典邏輯，不要動）或 `submitAdventure(w)`（1133）
2. `submitAdventure(w)`：呼叫 `battleDamage(word, tiles)`（997，傷害公式：字長基礎 + LETTER_SCORE 稀有字母加成 + 寶石磚加成，詛咒磚減半）扣怪物 HP → `removeTilesAdventure()`（915，原地補新磚，不做欄位掉落壓縮）→ 怪物死亡呼叫 `defeatMonster()`（1086，推進 monsterIdx/chapterIdx，**打完唯一一章的 Boss 後有保底循環邏輯**，回到 chapterIdx 不變、monsterIdx=0，避免卡關）；沒死則呼叫 `monsterCounter()`（1022，扣玩家 HP，機率觸發 `monsterSkillAlter()`）
3. **設計決定**：斬殺當回合不觸發反擊（1122 附近有註解說明，是刻意設計不是漏洞）
4. `monsterSkillAlter()`（1010）：隨機把場上 1-2 顆磚變成 `locked` 或 `cursed`
5. `renderAdvHud()`（1069）：更新 `#adv-hud` 裡的血條/名稱/怪物立繪 DOM——**這是重做 UI 版面時要大改或整個換掉的函式**，目前是直接 `getElementById` 抓幾個固定 id 更新 textContent/style.width
6. `monsterSpriteSvg(kind, isBoss)`（1029）：回傳怪物 SVG 字串（純字串拼接），三種 kind：`critter`/`blob`/`book`，接口是 `(kind, isBoss) → svg字串`，換美術只需要換這個函式內容，呼叫端不用動
7. 冒險模式負面磚清除改由橡皮擦道具處理，不再提供底部「清除負面磚」按鈕
8. `checkAdvOver()`（1102）：玩家 HP 歸零時觸發，顯示 `#adv-gameover` 遮罩
9. `initAdventure(fromSave)`（1113）：進場初始化，`fromSave=true` 時嘗試 `loadAdventure()` 恢復進度

## 存檔格式

全部用 `localStorage`，經典/冒險完全獨立 key，不互相干擾：

- `wordworm_save_v1`：經典模式，`{grid, score, wordCount, bestWord, bestWordScore, weakStreak, level}`（**沿用 v1 就有的 key 名不能改**，改了 Vickie 現有存檔會消失）
- `wordworm_save_adventure_v1`：冒險模式，`{grid, adv}`
- `wordworm_adv_progress`：冒險最佳進度，`{chapter, kills}`
- `wordworm_hiscore`：經典最高分
- `wordworm_gamemode`：`'classic'`/`'adventure'`，記住玩家上次選的模式
- `wordworm_easymode`：經典模式的「相鄰/任選」拼字規則開關（跟冒險模式無關，冒險模式固定全盤任選）

讀檔都有防禦性驗證（`isValidGrid()` 559 行、`isValidAdvState()` 601 行）：grid 維度、tile 是否有合法 `letter`、adv 數值型別與 chapterIdx/monsterIdx 邊界。驗證失敗會回傳 false，呼叫端 fallback 全新開局，不會 crash。**改資料結構時記得同步更新這兩個驗證函式**，不然新欄位會被舊驗證邏輯誤殺或新驗證邏輯漏檢查。

## 動工前該知道的坑

1. **`#wormface` 是 JS 直接依賴的 id**：`setFace()`（497）、`submitClassic`/`submitAdventure` 裡都用 `getElementById('wormface')`。裡面的 `worm-eyes-normal`/`worm-eyes-happy`/`worm-mouth` 三個 id 是表情切換機制，SVG 結構可以移動父層位置，但這幾個 id 不能改名或刪除，否則蟲蟲表情失效。
2. **v4 新增的側邊蟲蟲立繪** `#worm-corner`（經典/冒險共用）：如果 BWA 式版面要做「蟲蟲 vs 怪物面對面」戰鬥舞台，要考慮冒險模式下側邊蟲蟲跟戰鬥舞台裡的蟲蟲會不會重複出現，需要決定隱藏側邊版或整合成同一個。
3. **經典模式邏輯絕對不要動**：`submitClassic(w)`、`init()`、`loadGame()`/`saveGame()`、`shuffle()`（經典版洗牌）這些是 v1-v4 都在維護的核心，Vickie 的既有玩法/存檔都靠這些。冒險模式相關改動只碰 `*Adventure` 結尾的函式和 `#adv-*` 開頭的 DOM id。
4. **`Math.random()` 沒有做成 seeded RNG**：冒險模式的隨機（生磚、技能觸發、反擊）都是直接呼叫 `Math.random()`，沒有可重現性設計，這是刻意的（跟 pixel_terrarium 那種需要可重現模擬的專案不同）。
5. **AGPL 紀律**：冒險模式機制設計上參考了 BWA（Boggle Words Adventure，AGPL 授權）的「頻率生磚／稀有字母高傷害／技能置換磚」三個機制概念，但具體數值全部用本專案既有的 `LETTER_SCORE`/`LETTER_POOL`（432/439 行）重新映射，**原開發者沒有讀過/複製過 BWA 原始碼**，維持 clean-room。往後參考 BWA 或其他作品時，機制/玩法概念可以參考，具體程式碼/美術素材/數值表不要照抄，尤其地圖 UI 如果要照 BWA 畫面配置，僅限「資訊擺放方式」，美術素材必須自己畫。
6. **RWD 斷點**：`@media (max-width: 700px)`（蟲蟲立繪佈局 row→column）、`@media (max-width: 420px)`（磚塊縮小、按鈕 padding 縮小）。Vickie 主要用手機和 Mac，新版面務必兩種寬度都測。
7. **零外部資源原則要延續**：不要引 CDN、外部圖片、外部字型、外部 JS 套件。所有圖形用 inline SVG 或 CSS 手刻。
8. **`#mode` 按鈕**跟新的「模式選單」文字容易混淆：`#mode` 是經典模式限定的「相鄰拼字／任選拼字」規則切換鈕（v4 改過文案避免跟模式選單的「經典模式／冒險模式」撞字），不要跟 `#modesel-classic`/`#modesel-adventure`（遊戲模式選單）搞混。
9. **測試**：本專案沒有自動化測試框架，全靠手動瀏覽器操作 + console 直接呼叫函式驗證（例如 `selectGameMode('adventure')`、手動塞 `sel` 陣列呼叫 `submit()` 觀察狀態變化）。改動後建議至少手動跑一輪經典模式（拼字/升級/存讀檔）+ 一輪冒險模式（攻擊/技能磚/擊殺/死亡）確認沒有回歸。
