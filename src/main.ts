import './style.css';
import {
  applyMove,
  createBoard,
  getGameResult,
  isValidMove,
  opponentOf,
  idx,
  COLS,
  ROWS,
  type Board,
  type GameResult,
  type Player,
} from './game';
import { chooseMove, type Difficulty } from './ai';
import { detectLanguage, formatScore, getMessages, isLang, type Lang, type Messages } from './i18n';

const HUMAN: Player = 1; // 红方
const AI: Player = 2; // 黄方

const boardEl = document.getElementById('board') as HTMLElement;
const ghostRowEl = document.getElementById('ghost-row') as HTMLElement;
const statusEl = document.getElementById('status') as HTMLElement;
const difficultyEl = document.getElementById('difficulty') as HTMLSelectElement;
const firstPlayerEl = document.getElementById('first-player') as HTMLSelectElement;
const languageEl = document.getElementById('language') as HTMLSelectElement;
const newGameBtn = document.getElementById('new-game') as HTMLButtonElement;
const scoreEl = document.getElementById('score') as HTMLElement;

const cells: HTMLElement[] = [];
const discs: (HTMLElement | null)[] = new Array(ROWS * COLS).fill(null);
const ghostSlots: HTMLElement[] = [];

let board: Board = createBoard();
let current: Player = HUMAN;
let gameOver = false;
let busy = false;
let hoverCol: number | null = null;
let gameId = 0;

(function buildBoard() {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cells[idx(row, col)] = cell;
      boardEl.appendChild(cell);
    }
  }
  for (let col = 0; col < COLS; col++) {
    const slot = document.createElement('div');
    slot.className = 'ghost-slot';
    ghostSlots.push(slot);
    ghostRowEl.appendChild(slot);
  }
})();

// ---------- 界面语言（自动检测 + 手动切换） ----------

const LANG_KEY = 'con-four-lang';

function readStoredLang(): string | null {
  try {
    return localStorage.getItem(LANG_KEY);
  } catch {
    return null;
  }
}

function navigatorLanguages(): string[] {
  const langs = navigator.languages;
  if (langs && langs.length > 0) return [...langs];
  return [navigator.language];
}

let lang: Lang = detectLanguage(readStoredLang(), navigatorLanguages());

function applyStaticI18n() {
  const msg = getMessages(lang);
  document.documentElement.lang = lang;
  document.title = msg.title;
  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const key = el.dataset.i18n as keyof Messages;
    const text = msg[key];
    if (text !== undefined) el.textContent = text;
  }
  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n-title]')) {
    const key = el.dataset.i18nTitle as keyof Messages;
    const text = msg[key];
    if (text !== undefined) el.title = text;
  }
}

languageEl.addEventListener('change', () => {
  const next = languageEl.value;
  if (!isLang(next) || next === lang) return;
  lang = next;
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    // 写不进去也不影响本次界面的切换
  }
  applyStaticI18n();
  renderScore();
  setStatus(lastStatus);
});

// ---------- 比分（本地保存） ----------

interface Score {
  win: number;
  loss: number;
  draw: number;
}

const SCORE_KEY = 'con-four-score';

function loadScore(): Score {
  try {
    const raw = localStorage.getItem(SCORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Score>;
      return { win: parsed.win ?? 0, loss: parsed.loss ?? 0, draw: parsed.draw ?? 0 };
    }
  } catch {
    // 存档损坏时忽略，重新计分
  }
  return { win: 0, loss: 0, draw: 0 };
}

const score = loadScore();

function saveScore() {
  try {
    localStorage.setItem(SCORE_KEY, JSON.stringify(score));
  } catch {
    // 隐私模式等场景下写不进去也不影响游戏
  }
}

function renderScore() {
  scoreEl.textContent = formatScore(lang, score.win, score.loss, score.draw);
}

// ---------- 状态提示 ----------

type StatusKey = 'turn' | 'thinking' | 'new' | 'win' | 'lose' | 'draw';

const STATUS_CLASS: Record<StatusKey, string> = {
  turn: 'human',
  thinking: 'ai',
  new: 'human',
  win: 'win',
  lose: 'lose',
  draw: 'draw',
};

const STATUS_MESSAGE: Record<StatusKey, keyof Messages> = {
  turn: 'statusTurn',
  thinking: 'statusThinking',
  new: 'statusNew',
  win: 'statusWin',
  lose: 'statusLose',
  draw: 'statusDraw',
};

let lastStatus: StatusKey = 'new';

function setStatus(key: StatusKey) {
  lastStatus = key;
  statusEl.textContent = getMessages(lang)[STATUS_MESSAGE[key]];
  statusEl.className = `status ${STATUS_CLASS[key]}`;
}

// ---------- 落子与动画 ----------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function animateDrop(disc: HTMLElement, row: number): Promise<void> {
  const dropHeight = (row + 1.15) * 100;
  const fall = disc.animate(
    [
      { transform: `translateY(-${dropHeight}%)`, easing: 'cubic-bezier(0.5, 0, 0.9, 0.6)' },
      { transform: 'translateY(0%)' },
    ],
    { duration: 100 + row * 55, fill: 'both' },
  );
  return fall.finished
    .then(() => {
      const bounce = disc.animate(
        [
          { transform: 'translateY(0%) scaleY(1)' },
          { transform: 'translateY(5%) scaleY(0.88) scaleX(1.07)', offset: 0.45 },
          { transform: 'translateY(0%) scaleY(1)' },
        ],
        { duration: 170, easing: 'ease-out' },
      );
      return bounce.finished;
    })
    .then(() => undefined)
    .catch(() => undefined);
}

async function playMove(col: number, player: Player): Promise<void> {
  const token = gameId;
  busy = true;
  hideGhost();
  const moved = applyMove(board, col, player);
  if (!moved) {
    busy = false;
    return;
  }
  board = moved.board;

  const disc = document.createElement('div');
  disc.className = `disc p${player}`;
  cells[idx(moved.row, col)].appendChild(disc);
  discs[idx(moved.row, col)] = disc;
  // 后台标签页等场景下动画 Promise 可能长时间不 settle，用超时兜底保证回合继续
  await Promise.race([animateDrop(disc, moved.row), sleep(1500)]);
  if (token !== gameId) return; // 期间开了新对局，丢弃本轮结果

  const result = getGameResult(board);
  if (result.status !== 'playing') {
    finish(result);
    return;
  }
  current = opponentOf(player);
  busy = false;
  if (current === AI) scheduleAiMove();
  else setStatus('turn');
}

function scheduleAiMove() {
  const token = gameId;
  busy = true;
  setStatus('thinking');
  const difficulty = difficultyEl.value as Difficulty;
  const delay = 300 + Math.random() * 350;
  setTimeout(() => {
    if (token !== gameId || gameOver) return;
    const col = chooseMove(board, AI, difficulty);
    if (col < 0) return;
    void playMove(col, AI);
  }, delay);
}

function finish(result: GameResult) {
  gameOver = true;
  busy = false;
  boardEl.classList.add('finished');
  if (result.status === 'win') {
    for (const i of result.line) discs[i]?.classList.add('win-disc');
    if (result.winner === HUMAN) {
      score.win++;
      setStatus('win');
    } else {
      score.loss++;
      setStatus('lose');
    }
  } else {
    score.draw++;
    setStatus('draw');
  }
  saveScore();
  renderScore();
}

// ---------- 悬停预览与点击 ----------

function canHumanAct(): boolean {
  return !gameOver && !busy && current === HUMAN;
}

function hideGhost() {
  hoverCol = null;
  for (const slot of ghostSlots) slot.replaceChildren();
  for (const cell of cells) cell.classList.remove('hover');
}

function showGhost(col: number) {
  if (hoverCol === col) return;
  hideGhost();
  hoverCol = col;
  const ghost = document.createElement('div');
  ghost.className = 'disc p1 ghost';
  ghostSlots[col].appendChild(ghost);
  for (let row = 0; row < ROWS; row++) cells[idx(row, col)].classList.add('hover');
}

function columnFromEvent(e: MouseEvent): number | null {
  const rect = boardEl.getBoundingClientRect();
  const col = Math.floor(((e.clientX - rect.left) / rect.width) * COLS);
  return col >= 0 && col < COLS ? col : null;
}

boardEl.addEventListener('mousemove', (e) => {
  if (!canHumanAct()) return;
  const col = columnFromEvent(e);
  if (col !== null && isValidMove(board, col)) showGhost(col);
  else hideGhost();
});

boardEl.addEventListener('mouseleave', hideGhost);

boardEl.addEventListener('click', (e) => {
  if (!canHumanAct()) return;
  const col = columnFromEvent(e);
  if (col === null) return;
  if (!isValidMove(board, col)) {
    boardEl.animate(
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-5px)' },
        { transform: 'translateX(5px)' },
        { transform: 'translateX(0)' },
      ],
      { duration: 160 },
    );
    return;
  }
  void playMove(col, HUMAN);
});

// ---------- 新对局 ----------

function newGame() {
  gameId++;
  board = createBoard();
  gameOver = false;
  busy = false;
  discs.fill(null);
  for (const cell of cells) cell.replaceChildren();
  boardEl.classList.remove('finished');
  hideGhost();
  const aiFirst = firstPlayerEl.value === 'ai';
  current = aiFirst ? AI : HUMAN;
  if (current === AI) {
    scheduleAiMove();
  } else {
    setStatus('new');
  }
}

newGameBtn.addEventListener('click', newGame);

languageEl.value = lang;
applyStaticI18n();
renderScore();
newGame();
