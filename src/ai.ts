import {
  COLS,
  ROWS,
  WIN_LINES,
  applyMove,
  getGameResult,
  getValidMoves,
  idx,
  opponentOf,
  type Board,
  type Player,
} from './game';

export type Difficulty = 'easy' | 'medium' | 'hard';
export type Rng = () => number;

/** 普通难度：固定 2 层搜索（看得到取胜利与封堵，看不到深层陷阱） */
export const MEDIUM_DEPTH = 2;
/** 困难难度：迭代加深的最大深度，实际会受时间预算约束 */
export const HARD_MAX_DEPTH = 13;
/** 困难难度单步搜索的默认时间预算（毫秒），防止中盘思考过久 */
export const HARD_TIME_BUDGET_MS = 900;

export interface MoveOptions {
  /**
   * 困难难度单步搜索的时间预算（毫秒）。
   * 时间预算会让实际搜索深度随机器负载浮动；需要确定性行为时（如测试）可传 Infinity。
   */
  hardTimeBudgetMs?: number;
  /** 困难难度最大搜索深度（默认 HARD_MAX_DEPTH） */
  hardMaxDepth?: number;
}

/** 为当前局面选择落子列；无子可下时返回 -1 */
export function chooseMove(
  board: Board,
  player: Player,
  difficulty: Difficulty,
  rng: Rng = Math.random,
  options: MoveOptions = {},
): number {
  const moves = getValidMoves(board);
  if (moves.length === 0) return -1;
  if (difficulty === 'easy') return chooseEasy(board, player, moves, rng);
  if (difficulty === 'medium') return searchPlain(board, player, MEDIUM_DEPTH, rng);
  return searchHard(board, player, rng, options.hardTimeBudgetMs ?? HARD_TIME_BUDGET_MS, options.hardMaxDepth ?? HARD_MAX_DEPTH);
}

/** 简单难度：随机落子，但不会放过已经凑成三缺一的机会 */
function chooseEasy(board: Board, player: Player, moves: number[], rng: Rng): number {
  for (const col of moves) {
    const moved = applyMove(board, col, player);
    if (moved && getGameResult(moved.board).status === 'win') return col;
  }
  return pickRandom(moves, rng);
}

function pickRandom<T>(items: T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)];
}

/** 优先搜索中路以提升剪枝效率 */
const MOVE_ORDER = [3, 2, 4, 1, 5, 0, 6];

function orderMoves(moves: number[]): number[] {
  return MOVE_ORDER.filter((col) => moves.includes(col));
}

/** 局面启发式评分（player 视角，正值表示占优） */
function scorePosition(board: Board, player: Player): number {
  const opponent = opponentOf(player);
  let score = 0;

  // 占据中路在攻防两端都更有价值
  for (let row = 0; row < ROWS; row++) {
    const v = board[idx(row, 3)];
    if (v === player) score += 6;
    else if (v === opponent) score -= 6;
  }

  // 统计所有四格窗口中双方棋子的分布。
  // 三缺一的"威胁"按威胁点所在行高区分价值：僵持到残局时双方都无法立即成四，
  // 行高奇偶决定谁被迫先垫子——先手方（1 号）受益于奇数行威胁，后手方（2 号）受益于偶数行威胁
  for (const line of WIN_LINES) {
    let mine = 0;
    let theirs = 0;
    let emptyIdx = -1;
    for (let k = 0; k < 4; k++) {
      const v = board[line[k]];
      if (v === player) mine++;
      else if (v === opponent) theirs++;
      else emptyIdx = line[k];
    }
    if (mine > 0 && theirs > 0) continue; // 混合窗口已无威胁
    if (mine === 3) {
      const oddRow = Math.floor(emptyIdx / COLS) % 2 === 1; // 威胁点在从底数第奇数行
      const favorable = player === 1 ? oddRow : !oddRow;
      score += favorable ? 90 : 40;
    } else if (mine === 2) score += 8;
    else if (mine === 1) score += 1;
    if (theirs === 3) {
      const oddRow = Math.floor(emptyIdx / COLS) % 2 === 1;
      const oppFavorable = opponent === 1 ? oddRow : !oddRow;
      score -= oppFavorable ? 100 : 60;
    } else if (theirs === 2) score -= 9;
    else if (theirs === 1) score -= 1;
  }
  return score;
}

const WIN_BONUS = 1_000_000;

// ---------------------------------------------------------------------------
// 置换表（Zobrist 哈希）：同一局面换不同的落子顺序会大量重复出现，
// 缓存已搜索过的局面分值可以让深层搜索在时间预算内完成
// ---------------------------------------------------------------------------

const CELLS = ROWS * 7;

function localRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rngForHash = localRng(0x5eed_c0de);
const HASH_A = new Uint32Array(2 * CELLS);
const HASH_B = new Uint32Array(2 * CELLS);
for (let i = 0; i < 2 * CELLS; i++) {
  HASH_A[i] = Math.floor(rngForHash() * 4294967296) >>> 0;
  HASH_B[i] = Math.floor(rngForHash() * 4294967296) >>> 0;
}
const SIDE_A = Math.floor(rngForHash() * 4294967296) >>> 0;
const SIDE_B = Math.floor(rngForHash() * 4294967296) >>> 0;
// 分值总是相对"搜索方"存储，盐值区分两套视角，避免 AI 互搏时串表
const VIEW_A = Math.floor(rngForHash() * 4294967296) >>> 0;
const VIEW_B = Math.floor(rngForHash() * 4294967296) >>> 0;

function hashBoard(board: Board, turn: Player, me: Player): [number, number] {
  let a = 0;
  let b = 0;
  for (let i = 0; i < board.length; i++) {
    const v = board[i];
    if (v !== 0) {
      const k = (v - 1) * CELLS + i;
      a = (a ^ HASH_A[k]) >>> 0;
      b = (b ^ HASH_B[k]) >>> 0;
    }
  }
  if (turn === 2) {
    a = (a ^ SIDE_A) >>> 0;
    b = (b ^ SIDE_B) >>> 0;
  }
  if (me === 2) {
    a = (a ^ VIEW_A) >>> 0;
    b = (b ^ VIEW_B) >>> 0;
  }
  return [a, b];
}

interface TTEntry {
  b: number; // 校验用第二哈希
  depth: number;
  flag: 0 | 1 | 2; // 0 精确值，1 下界（>= value），2 上界（<= value）
  value: number;
}

const TT = new Map<number, TTEntry>();
const TT_LIMIT = 500_000;

// ---------------------------------------------------------------------------
// 搜索
// ---------------------------------------------------------------------------

class SearchAborted extends Error {}

let deadline = Infinity;
let nodeCounter = 0;

function checkTime() {
  if (++nodeCounter >= 2048) {
    nodeCounter = 0;
    if (Date.now() > deadline) throw new SearchAborted();
  }
}

/** 极小极大搜索（Alpha-Beta 剪枝 + 置换表），返回当前局面对 me 的分值 */
function minimax(
  board: Board,
  hashA: number,
  hashB: number,
  depth: number,
  alpha: number,
  beta: number,
  turn: Player,
  me: Player,
): number {
  const cached = TT.get(hashA);
  if (
    cached !== undefined &&
    cached.b === hashB &&
    cached.depth >= depth
  ) {
    if (cached.flag === 0) return cached.value;
    if (cached.flag === 1 && cached.value >= beta) return cached.value;
    if (cached.flag === 2 && cached.value <= alpha) return cached.value;
  }

  const result = getGameResult(board);
  if (result.status === 'win') {
    // 剩余深度越大说明胜负来得越早，加减成让 AI 追求速胜、拖延败局
    const bonus = WIN_BONUS + depth * 1000;
    return result.winner === me ? bonus : -bonus;
  }
  if (result.status === 'draw') return 0;
  if (depth === 0) return scorePosition(board, me);
  checkTime();

  const alphaOrig = alpha;
  const moves = orderMoves(getValidMoves(board));
  const maximizing = turn === me;
  let best = maximizing ? -Infinity : Infinity;
  for (const col of moves) {
    const moved = applyMove(board, col, turn)!;
    const k = (turn - 1) * CELLS + idx(moved.row, col);
    const childA = (hashA ^ HASH_A[k] ^ SIDE_A) >>> 0;
    const childB = (hashB ^ HASH_B[k] ^ SIDE_B) >>> 0;
    const score = minimax(moved.board, childA, childB, depth - 1, alpha, beta, opponentOf(turn), me);
    if (maximizing) {
      if (score > best) best = score;
      if (best > alpha) alpha = best;
    } else {
      if (score < best) best = score;
      if (best < beta) beta = best;
    }
    if (alpha >= beta) break;
  }

  // 胜负分值带"距离"信息，与节点深度相关，不入表以免跨深度误用
  if (Math.abs(best) < WIN_BONUS) {
    const flag: 0 | 1 | 2 = best <= alphaOrig ? 2 : best >= beta ? 1 : 0;
    if (TT.size >= TT_LIMIT) TT.clear();
    TT.set(hashA, { b: hashB, depth, flag, value: best });
  }
  return best;
}

/** 每个候选落子用全窗口求精确分值，在并列最优中随机挑一个，避免每局打法完全相同 */
function evaluateRoot(
  board: Board,
  player: Player,
  orderedCols: number[],
  depth: number,
): { col: number; score: number }[] {
  const results: { col: number; score: number }[] = [];
  for (const col of orderedCols) {
    const moved = applyMove(board, col, player)!;
    const [childA, childB] = hashBoard(moved.board, opponentOf(player), player);
    const score = minimax(
      moved.board,
      childA,
      childB,
      depth - 1,
      -Infinity,
      Infinity,
      opponentOf(player),
      player,
    );
    results.push({ col, score });
  }
  return results;
}

/** 普通难度：固定深度、无迭代加深 */
function searchPlain(board: Board, player: Player, depth: number, rng: Rng): number {
  deadline = Infinity;
  const results = evaluateRoot(board, player, orderMoves(getValidMoves(board)), depth);
  return pickBest(results, rng);
}

/** 困难难度：迭代加深 + 置换表 + 时间预算；按上一轮得分排序走子以加强剪枝 */
function searchHard(board: Board, player: Player, rng: Rng, budgetMs: number, maxDepth: number): number {
  deadline = Date.now() + budgetMs;
  let results: { col: number; score: number }[] = orderMoves(getValidMoves(board)).map((col) => ({
    col,
    score: -Infinity,
  }));
  for (let depth = 2; depth <= maxDepth; depth++) {
    const ordered = [...results].sort((x, y) => y.score - x.score).map((r) => r.col);
    try {
      results = evaluateRoot(board, player, ordered, depth);
    } catch (error) {
      if (error instanceof SearchAborted) break; // 超预算：沿用上一个完整深度的结果
      throw error;
    }
  }
  return pickBest(results, rng);
}

function pickBest(results: { col: number; score: number }[], rng: Rng): number {
  const bestScore = Math.max(...results.map((r) => r.score));
  const bestMoves = results.filter((r) => r.score === bestScore).map((r) => r.col);
  return bestMoves.length === 1 ? bestMoves[0] : pickRandom(bestMoves, rng);
}
