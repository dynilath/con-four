import { expect } from 'vitest';
import { COLS, ROWS, createBoard, idx, type Board } from '../src/game';

/** 用字符画构造棋盘：'.' 空、'R' 红(1)、'Y' 黄(2)；首行为第 0 行（顶部） */
export function boardFrom(art: string[]): Board {
  expect(art.length).toBe(ROWS);
  const board = createBoard();
  art.forEach((rowStr, row) => {
    expect(rowStr.length).toBe(COLS);
    [...rowStr].forEach((ch, col) => {
      board[idx(row, col)] = ch === 'R' ? 1 : ch === 'Y' ? 2 : 0;
    });
  });
  return board;
}

/** 可复现的伪随机数生成器（mulberry32），用于让涉及随机的测试确定化 */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
