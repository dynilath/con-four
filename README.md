# 重力四子棋（Connect Four）

基于经典桌面玩具 Connect Four 的网页单机游戏。棋盘为 **6 行 × 7 列**，棋子从顶部投入后受"重力"作用落到该列最底部的空格；横、竖、斜任意方向率先连成四子的一方获胜，棋盘下满未分胜负则为平局。

## 功能

- 6×7 棋盘、重力落子、四连判定（横 / 竖 / 双对角线）
- 棋子下坠与落地回弹动画、悬停列高亮与落子预览
- 三档 AI 难度（见下），对局中途也可随时切换
- 先手方可选（我执红先行 / AI 执黄先行）
- 界面支持英文 / 中文 / 日文，默认跟随浏览器语言自动选择，也可手动切换（见下）
- 胜负比分统计，本地保存
- 响应式布局，桌面与手机浏览器均可玩
- 通过 GitHub Actions 自动部署到 GitHub Pages

## AI 难度

| 难度 | 策略 |
| --- | --- |
| 简单 | 随机落子，但不会放过眼前已凑成三缺一的机会；适合熟悉规则 |
| 普通 | 2 层极小极大搜索（Minimax）：主动取胜、封堵对手即将连成的四、不垫"送胜"棋 |
| 困难 | 迭代加深 + Alpha-Beta 剪枝 + Zobrist 置换表 + 900ms 时间预算的深度搜索（最深 13 层），配合四连窗口计数、中路偏好与**行高奇偶威胁**感知的启发式评估，能算出多步强制取胜与双向威胁 |

> 单元测试中包含 AI 互搏对局（困难 6:0 普通等），受深度搜索影响 `pnpm test` 全程约需 3 分钟。

## 界面语言

界面文案（标题、按钮、状态提示、比分等）有 **English / 中文 / 日本語** 三个版本：

- **自动选择**：首次打开页面时按 `navigator.languages` 依次匹配 `zh` / `ja` / `en` 前缀，全部不命中时回退英文；
- **手动切换**：控制栏的"语言"下拉可随时切换，选择保存在 `localStorage`（键 `con-four-lang`），此后以手动选择为准；
- 词典与检测逻辑在 `src/i18n.ts`，纯函数实现并有完整单元测试（含三语键一致性校验）。

## 部署（GitHub Pages）

`.github/workflows/deploy.yml` 会在推送到 `main`（或手动触发 workflow）时自动：安装 pnpm → 运行全部单元测试 → 构建 → 部署到 GitHub Pages。

启用步骤：

1. 将仓库推送到 GitHub；
2. 仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**（仅需设置一次）；
3. 之后每次推送 `main` 都会自动部署，页面地址为 `https://<用户名>.github.io/<仓库名>/`。

构建使用相对资源路径（`vite.config.ts` 中 `base: './'`），因此无论是用户主页仓库（`<用户名>.github.io`）还是项目子路径都能正确加载。

## 开发

本仓库使用 **pnpm** 管理依赖：

```bash
pnpm install    # 安装依赖
pnpm dev        # 启动开发服务器（默认 http://localhost:5173）
pnpm test       # 运行单元测试（vitest）
pnpm build      # 类型检查 + 生产构建
pnpm preview    # 预览构建产物
```

## 项目结构

```
con-four/
├── index.html              # 页面结构（文案挂 data-i18n 钩子）
├── public/favicon.svg
├── vite.config.ts          # 构建配置（base: './'，适配 GitHub Pages 子路径）
├── .github/workflows/
│   └── deploy.yml          # 推送 main 自动测试 + 构建 + 部署 GitHub Pages
├── src/
│   ├── game.ts             # 棋盘规则（重力落子、四连判定，纯逻辑无 DOM）
│   ├── ai.ts               # 三档难度的 AI
│   ├── i18n.ts             # en/zh/ja 词典、浏览器语言检测与记忆
│   ├── main.ts             # 界面交互与渲染
│   └── style.css           # 样式与动画
└── tests/                  # vitest 单元测试（规则 11 例 + AI 13 例 + 语言 13 例）
```

技术栈：TypeScript + Vite + Vitest，**零运行时依赖**，使用 git 进行版本控制。
