# Word Worm 冒險模式戰鬥 UI 設計稿標註

交付日期：2026-07-09  
範圍：HANDOFF.md「1. 戰鬥介面重做」設計稿，不包含實作程式碼修改。

## 圖檔

- 桌面版 mockup：`D:\tsunu_plan\wordworm\design\wordworm_battle_desktop_mockup.png`
- 手機直向 mockup：`D:\tsunu_plan\wordworm\design\wordworm_battle_mobile_mockup.png`
- 420px 邊界檢查圖：`D:\tsunu_plan\wordworm\design\wordworm_battle_mobile420_check.png`
- 可重截的原始稿：`D:\tsunu_plan\wordworm\design\wordworm_battle_ui_mockup.html`

## 桌面版配置

1. 上方是完整戰鬥舞台：玩家蟲蟲在左、怪物在右，兩者面對面站在同一個木質舞台內。
2. 目前拼出的字以字母磚浮在舞台上方中央，避免和 4x4 棋盤混淆。
3. 玩家與怪物血條放在各自角色下方的 nameplate 裡，血量文字靠右，方便掃讀。
4. 中下方主操作區分三欄：左道具欄、中間 4x4 棋盤、右怪物技能欄。
5. 道具欄只保留框架與空 slot，標示「下一期／即將推出」，不要接功能。
6. 怪物技能欄顯示名稱、小圖示與一句短說明；圖示可用 CSS 或 inline SVG 手刻。
7. 下方 Attack / 攻擊是唯一主按鈕，清除選字維持次要按鈕視覺；負面磚清除移到橡皮擦道具。

## 手機直向配置

1. 700px 以下改為單欄堆疊：戰鬥舞台在上、棋盤在中、操作按鈕在棋盤下。
2. 道具欄與怪物技能欄收合成兩條 drawer row，預設只顯示摘要；之後可做展開面板。
3. 420px 以下縮小棋盤磚塊與間距，保持 4x4 棋盤完整可見，不橫向捲動。
4. 手機版不放中央傷害預估膠囊，避免壓到角色血條；傷害回饋可沿用 toast 或攻擊動畫。

## 美術與版權界線

- 只參考 Bookworm Adventures 的資訊擺放節奏，不參考或仿畫任何原作素材。
- 圖中蟲蟲、紙頁鼠、按鈕、字母磚、書房背景都是 CSS / inline SVG 自製示意。
- 延續現有 Word Worm 的木質書房、奶油字母磚、金色主按鈕、綠色蟲蟲風格。
- 不引入外部圖片、字型、CDN、JS 套件。

## 實作提醒

- 冒險模式下請隱藏現有側邊 `#worm-corner`，避免與戰鬥舞台內的蟲蟲重複出現。
- `#wormface`、`#worm-eyes-normal`、`#worm-eyes-happy`、`#worm-mouth` 是現有 JS 依賴，若移入舞台也不要改 id。
- 優先改 `#adv-*` DOM 與 `*Adventure` 函式；經典模式 DOM、存檔與 `submitClassic()` 不要碰。
- `renderAdvHud()` 可以改成更新新的舞台血條、角色名稱、浮字與技能欄。
- 怪物技能欄可先根據現有 `locked` / `cursed` 機制寫死，再等後續怪物資料結構擴充。
- 手機收合列可先做靜態摘要，不一定要在第一版完成展開互動。
