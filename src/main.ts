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

const HUMAN: Player = 1; // 红方
const AI: Player = 2; // 黄方

const boardEl = document.getElementById('board') as HTMLElement;
const ghostRowEl = document.getElementById('ghost-row') as HTMLElement;
const statusEl = document.getElementById('status') as HTMLElement;
const difficultyEl = document.getElementById('difficulty') as HTMLSelectElement;
const firstPlayerEl = document.getElementById('first-player') as HTMLSelectElement;
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
  scoreEl.textContent = `你 ${score.win} : ${score.loss} AI · 平 ${score.draw}`;
}

// ---------- 状态提示 ----------

function setStatus(text: string, kind: 'human' | 'ai' | 'win' | 'lose' | 'draw') {
  statusEl.textContent = text;
  statusEl.className = `status ${kind}`;
}

// ---------- 落子与动画 ----------

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
  await animateDrop(disc, moved.row);
  if (token !== gameId) return; // 期间开了新对局，丢弃本轮结果

  const result = getGameResult(board);
  if (result.status !== 'playing') {
    finish(result);
    return;
  }
  current = opponentOf(player);
  busy = false;
  if (current === AI) scheduleAiMove();
  else setStatus('轮到你了 · 红子', 'human');
}

function scheduleAiMove() {
  const token = gameId;
  busy = true;
  setStatus('AI 思考中…', 'ai');
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
      setStatus('🎉 恭喜，你连成四子获胜！', 'win');
    } else {
      score.loss++;
      setStatus('AI 连成四子，这局输了', 'lose');
    }
  } else {
    score.draw++;
    setStatus('🤝 棋盘已满，平局', 'draw');
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
    setStatus('新对局开始 · 你执红先行', 'human');
  }
}

newGameBtn.addEventListener('click', newGame);

renderScore();
newGame();
