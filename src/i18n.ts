// 界面多语言：英文 / 中文 / 日文。
// 默认按 navigator.languages 依次匹配（zh/ja/en 前缀），都不命中时回退英文；
// 用户手动切换后写入 localStorage，此后以手动选择为准。

export type Lang = 'en' | 'zh' | 'ja';

export const LANGS: readonly Lang[] = ['en', 'zh', 'ja'];

export interface Messages {
  title: string;
  appTitle: string;
  subtitle: string;
  languageLabel: string;
  difficultyLabel: string;
  difficultyEasy: string;
  difficultyMedium: string;
  difficultyHard: string;
  difficultyTitle: string;
  firstPlayerLabel: string;
  firstPlayerTitle: string;
  firstHuman: string;
  firstAi: string;
  newGame: string;
  scoreTitle: string;
  scoreFormat: string;
  statusTurn: string;
  statusThinking: string;
  statusNew: string;
  statusWin: string;
  statusLose: string;
  statusDraw: string;
  boardTitle: string;
  hint: string;
  repoLink: string;
}

const MESSAGES: Record<Lang, Messages> = {
  en: {
    title: 'Gravity Connect Four',
    appTitle: 'Gravity Connect Four',
    subtitle: 'Connect Four · 6×7 board · Play vs AI',
    languageLabel: 'Language',
    difficultyLabel: 'AI difficulty',
    difficultyEasy: 'Easy',
    difficultyMedium: 'Normal',
    difficultyHard: 'Hard',
    difficultyTitle: 'Takes effect immediately for the AI’s next move',
    firstPlayerLabel: 'First move',
    firstPlayerTitle: 'Takes effect when “New game” is clicked',
    firstHuman: 'Me (red)',
    firstAi: 'AI (yellow)',
    newGame: 'New game',
    scoreTitle: 'You : AI (draws)',
    scoreFormat: 'You {win} : {loss} AI · Draws {draw}',
    statusTurn: 'Your turn · red discs',
    statusThinking: 'AI is thinking…',
    statusNew: 'New game · you play red and move first',
    statusWin: '🎉 Congratulations, you connected four!',
    statusLose: 'The AI connected four — you lose this one',
    statusDraw: '🤝 Board is full — it’s a draw',
    boardTitle: 'Click a column to drop your disc',
    hint: 'Discs fall to the lowest empty cell of the column · connect four in a row (horizontal, vertical or diagonal) to win',
    repoLink: 'View source on GitHub',
  },
  zh: {
    title: '重力四子棋 · Connect Four',
    appTitle: '重力四子棋',
    subtitle: 'Connect Four · 6×7 棋盘 · 人机对战',
    languageLabel: '语言',
    difficultyLabel: 'AI 难度',
    difficultyEasy: '简单',
    difficultyMedium: '普通',
    difficultyHard: '困难',
    difficultyTitle: '切换后对 AI 的下一步落子立即生效',
    firstPlayerLabel: '先手方',
    firstPlayerTitle: '点击「新对局」时生效',
    firstHuman: '我（红）',
    firstAi: 'AI（黄）',
    newGame: '新对局',
    scoreTitle: '你 : AI（平局数）',
    scoreFormat: '你 {win} : {loss} AI · 平 {draw}',
    statusTurn: '轮到你了 · 红子',
    statusThinking: 'AI 思考中…',
    statusNew: '新对局开始 · 你执红先行',
    statusWin: '🎉 恭喜，你连成四子获胜！',
    statusLose: 'AI 连成四子，这局输了',
    statusDraw: '🤝 棋盘已满，平局',
    boardTitle: '点击某一列落下棋子',
    hint: '棋子从顶部投入后落至该列最底部 · 横、竖、斜先连成四子者获胜',
    repoLink: '在 GitHub 查看源码',
  },
  ja: {
    title: '重力コネクトフォー',
    appTitle: '重力コネクトフォー',
    subtitle: 'コネクトフォー · 6×7盤 · AI対戦',
    languageLabel: '言語',
    difficultyLabel: 'AIの難易度',
    difficultyEasy: 'やさしい',
    difficultyMedium: 'ふつう',
    difficultyHard: 'むずかしい',
    difficultyTitle: '変更するとAIの次の手からすぐに反映されます',
    firstPlayerLabel: '先攻',
    firstPlayerTitle: '「新しい対局」を押したときに有効になります',
    firstHuman: '自分（赤）',
    firstAi: 'AI（黄）',
    newGame: '新しい対局',
    scoreTitle: '自分 : AI（引き分け数）',
    scoreFormat: 'あなた {win} : {loss} AI · 引分 {draw}',
    statusTurn: 'あなたの番です · 赤コマ',
    statusThinking: 'AIが考えています…',
    statusNew: '新しい対局開始 · あなたが赤で先攻です',
    statusWin: '🎉 おめでとう、4つつながって勝ちました！',
    statusLose: 'AIが4つつなげました。この局は負けです',
    statusDraw: '🤝 盤面がいっぱいになりました。引き分け',
    boardTitle: '列をクリックしてコマを落とします',
    hint: 'コマは選んだ列の一番下まで落ちます · 縦・横・ななめのいずれかで先に4つ並べたら勝ち',
    repoLink: 'GitHub でソースを表示',
  },
};

export function isLang(value: unknown): value is Lang {
  return value === 'en' || value === 'zh' || value === 'ja';
}

export function getMessages(lang: Lang): Messages {
  return MESSAGES[lang];
}

// stored：localStorage 中的手动选择（可能为 null 或非法值）；candidates：navigator.languages。
// 依次用 zh/ja/en 前缀匹配，全部不命中时回退英文。
export function detectLanguage(
  stored: string | null | undefined,
  candidates: readonly string[],
): Lang {
  if (isLang(stored)) return stored;
  for (const tag of candidates) {
    const lower = tag.toLowerCase();
    if (lower.startsWith('zh')) return 'zh';
    if (lower.startsWith('ja')) return 'ja';
    if (lower.startsWith('en')) return 'en';
  }
  return 'en';
}

export function formatScore(lang: Lang, win: number, loss: number, draw: number): string {
  return getMessages(lang)
    .scoreFormat.replace('{win}', String(win))
    .replace('{loss}', String(loss))
    .replace('{draw}', String(draw));
}
