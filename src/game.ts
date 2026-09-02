export const ROWS = 6;
export const COLS = 7;

export type Player = 1 | 2;
export type Cell = 0 | 1 | 2;
export type Board = Cell[];

/** 棋盘上所有可能连成四子的连线（每条 4 个格子下标），共 69 条 */
export const WIN_LINES: readonly number[][] = buildWinLines();

function buildWinLines(): number[][] {
  const lines: number[][] = [];
  const directions = [
    [0, 1], // 横向
    [1, 0], // 纵向
    [1, 1], // 右下对角
    [-1, 1], // 右上对角
  ];
  for (const [dr, dc] of directions) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const endR = r + dr * 3;
        const endC = c + dc * 3;
        if (endR < 0 || endR >= ROWS || endC < 0 || endC >= COLS) continue;
        lines.push([
          r * COLS + c,
          (r + dr) * COLS + (c + dc),
          (r + dr * 2) * COLS + (c + dc * 2),
          endR * COLS + endC,
        ]);
      }
    }
  }
  return lines;
}

export function createBoard(): Board {
  return new Array<Cell>(ROWS * COLS).fill(0);
}

export function idx(row: number, col: number): number {
  return row * COLS + col;
}

export function isValidMove(board: Board, col: number): boolean {
  return col >= 0 && col < COLS && board[idx(0, col)] === 0;
}

export function getValidMoves(board: Board): number[] {
  const moves: number[] = [];
  for (let col = 0; col < COLS; col++) {
    if (isValidMove(board, col)) moves.push(col);
  }
  return moves;
}

/** 棋子在 col 列最终会停在第几行（0 为顶部），列满时返回 -1 */
export function getDropRow(board: Board, col: number): number {
  for (let row = ROWS - 1; row >= 0; row--) {
    if (board[idx(row, col)] === 0) return row;
  }
  return -1;
}

export interface MoveResult {
  board: Board;
  row: number;
  col: number;
}

/** 在 col 列落子：受重力作用，棋子落到该列最底部的空格；列已满时返回 null */
export function applyMove(board: Board, col: number, player: Player): MoveResult | null {
  if (!isValidMove(board, col)) return null;
  const row = getDropRow(board, col);
  const next = board.slice() as Board;
  next[idx(row, col)] = player;
  return { board: next, row, col };
}

export type GameResult =
  | { status: 'playing' }
  | { status: 'win'; winner: Player; line: number[] }
  | { status: 'draw' };

export function getGameResult(board: Board): GameResult {
  for (const line of WIN_LINES) {
    const first = board[line[0]];
    if (first === 0) continue;
    if (first === board[line[1]] && first === board[line[2]] && first === board[line[3]]) {
      return { status: 'win', winner: first, line: [...line] };
    }
  }
  if (getValidMoves(board).length === 0) return { status: 'draw' };
  return { status: 'playing' };
}

export function opponentOf(player: Player): Player {
  return player === 1 ? 2 : 1;
}
