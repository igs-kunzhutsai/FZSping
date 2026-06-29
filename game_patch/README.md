# 🎮 Game Systems & Water Level Probability Patch

本資料夾包含了本次重構與最佳化的核心遊戲系統程式碼，已完整翻譯並調整自原 C++ 版本的水位與機率控制機制。您可以直接將此資料夾的內容複製並合併至您的其他分支（Branch）或獨立專案中。

---

## 📂 檔案目錄結構與說明

### 1. 核心機率與水位管理 (Probability & Buffers)
* **`src/game/systems/ProbabilityManager.ts`**
  * **功能**：完成原 C++ 版本的核心機率與**水位控制緩衝（Water Level Buffer）**的完整翻譯。
  * **機制**：
    * **主緩衝 (Main Buffer)** 與各類子緩衝：包括特武（Special Weapon）、彩金（Jackpot）、任務（Mission）等。
    * **水位轉移限制**：設定 `SCALE_FACTOR`（控制水位比例因子，當前調整為 `2` 以最佳化彩票與道具產出曲線）。
    * 支援玩家等級計算、彩票生成比例限制、水位過高/過低時的安全保護與轉移邏輯（例如：特武與 SP 之間的水位轉換）。

### 2. 遊戲子系統 (Subsystems)
* **`src/game/systems/CollisionSystem.ts`**
  * **功能**：最佳化碰撞偵測邏輯。包含殭屍與子彈、障礙物、玩家、掉落彩票與道具的精確物理判定與回饋。
* **`src/game/systems/SoundSystem.ts`**
  * **功能**：模組化音效管理。支援背景音樂（BGM）與各種音效（SE）的動態載入、音量調整、播放通道控制與資源釋放。
* **`src/game/systems/InputSystem.ts`**
  * **功能**：統一鍵盤與滑鼠事件監聽，精確更新玩家角色的移動方向與射擊/特武觸發輸入，降低輸入延遲。
* **`src/game/systems/EffectSystem.ts`**
  * **功能**：獨立管理遊戲畫面上的粒子效果、受擊特效、道具拾取視覺反饋等，提升渲染效率。

### 3. 遊戲核心引擎與行為邏輯
* **`src/game/GameEngine.ts`**
  * **功能**：整合上述所有子系統的主循環控制。處理遊戲狀態、玩家屬性、殭屍生成、彩票掉落 (`spawnTicket`) 等全局流程調度。
* **`src/game/zombieBehavior.ts`**
  * **功能**：提取並管理所有殭屍的基礎 AI 與尋路、攻擊行為，確保行為邏輯與渲染徹底解耦。
* **`src/game/zombies/BombZombie.ts`**
  * **功能**：具體實現爆炸殭屍（BombZombie）的特殊行為與範圍爆炸波及判定。
* **`src/game/types.ts`**
  * **功能**：全域 TypeScript 類型與枚舉（Enum）定義，包含緩衝區類型 `BUF_TYPE`、遊戲事件、實體介面等。

### 4. 自動化重構與修復腳本 (Utility Scripts)
* **`fix_systems.cjs`**, **`refactor_engine.cjs`**, **`refactor_renderer.cjs`**, **`process_skills.cjs`**
  * **功能**：用於進行批量系統翻譯、正規表達式語法自動對齊與程式碼模組化重構的自動化工具腳本。

---

## 🚀 如何將此 Patch 搬移至另一個專案/分支

請依照以下步驟安全地合併這些修改：

### 步驟 1：複製檔案
1. 將本 `game_patch/src` 目錄下的所有檔案直接覆蓋至目標專案/分支的對應 `src` 目錄中。
2. 若需要自動化輔助腳本，可將根目錄下的 `.cjs` 檔案複製到目標專案的根目錄下。

### 步驟 2：確認依賴項
請確認目標專案的 `package.json` 中已安裝以下核心套件：
* **`react`** / **`react-dom`** (React 18+)
* **`lucide-react`** (用於圖示庫)
* **`motion`** (動畫庫)
* **`vite`** / **`typescript`**

### 步驟 3：編譯與語法檢查
在目標專案根目錄下執行以下指令，確保類型系統與編譯完全正常：

```bash
# 執行 Linter 檢查語法與類型
npm run lint

# 進行生產環境編譯測試
npm run build
```

---

## 💡 水位平衡調整指南 (Balancing Note)
在 `src/game/systems/ProbabilityManager.ts` 中，
* `SCALE_FACTOR` 已自 `10` 調整為 `2`。這會影響水位轉移時的閾值大小。
* 如果您在目標專案中希望進一步微調玩家的水位體驗（例如提高難度或增加回饋感），可以直接調整該變數：
  * **數值調高 (如 10)**：代表轉移水位所需累積的金額變多，水位反應較慢。
  * **數值調低 (如 1 或 2)**：代表水位轉換更加靈敏，獎勵與特武的狀態切換更加頻繁。
