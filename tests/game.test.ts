import { describe, expect, it } from 'vitest';
import {
  COLS,
  ROWS,
  WIN_LINES,
  applyMove,
  createBoard,
  getDropRow,
  getGameResult,
  getValidMoves,
  idx,
  isValidMove,
  type Player,
} from '../src/game';
import { boardFrom } from './helpers';

describe('棋盘与落子（重力）', () => {
  it('预生成的四连线共 69 条', () => {
    expect(WIN_LINES.length).toBe(69);
  });

  it('空棋盘：所有列可下，落子沉到底部', () => {
    const board = createBoard();
    expect(getValidMoves(board)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(getDropRow(board, 3)).toBe(ROWS - 1);

    const moved = applyMove(board, 3, 1);
    expect(moved).not.toBeNull();
    expect(moved!.board[idx(5, 3)]).toBe(1);
    expect(moved!.row).toBe(5);
    expect(moved!.board.filter((cell) => cell !== 0).length).toBe(1);
  });

  it('同一列连续落子时自下而上堆叠', () => {
    let board = createBoard();
    board = applyMove(board, 2, 1)!.board;
    board = applyMove(board, 2, 2)!.board;
    expect(board[idx(5, 2)]).toBe(1);
    expect(board[idx(4, 2)]).toBe(2);
    expect(board[idx(3, 2)]).toBe(0);
  });

  it('非法落子：越界列与已满列', () => {
    expect(isValidMove(createBoard(), -1)).toBe(false);
    expect(isValidMove(createBoard(), COLS)).toBe(false);

    let board = createBoard();
    for (let i = 0; i < ROWS; i++) {
      const player: Player = i % 2 === 0 ? 1 : 2;
      board = applyMove(board, 0, player)!.board;
    }
    expect(isValidMove(board, 0)).toBe(false);
    expect(applyMove(board, 0, 1)).toBeNull();
    expect(getValidMoves(board)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('胜负判定', () => {
  it('横向四连获胜，并给出获胜连线', () => {
    const board = boardFrom([
      '.......',
      '.......',
      '.......',
      '.......',
      '.......',
      'RRRRY..',
    ]);
    const result = getGameResult(board);
    expect(result.status).toBe('win');
    if (result.status === 'win') {
      expect(result.winner).toBe(1);
      expect(result.line).toEqual([idx(5, 0), idx(5, 1), idx(5, 2), idx(5, 3)]);
    }
  });

  it('纵向四连获胜', () => {
    const board = boardFrom([
      '.......',
      '.......',
      '..R....',
      '..R....',
      '..R....',
      '..R....',
    ]);
    const result = getGameResult(board);
    expect(result.status).toBe('win');
    expect(result.status === 'win' && result.winner).toBe(1);
  });

  it('右下方向对角四连获胜', () => {
    const board = boardFrom([
      '.......',
      '.......',
      '...R...',
      '....R..',
      '.....R.',
      '......R',
    ]);
    expect(getGameResult(board).status).toBe('win');
  });

  it('右上方向对角四连获胜', () => {
    const board = boardFrom([
      '.......',
      '.......',
      '...R...',
      '..R....',
      '.R.....',
      'R......',
    ]);
    const result = getGameResult(board);
    expect(result.status).toBe('win');
    expect(result.status === 'win' && result.winner).toBe(1);
  });

  it('黄方（2）获胜也能被识别', () => {
    const board = boardFrom([
      '.......',
      '.......',
      '.......',
      '.......',
      '.......',
      '.YYYY..',
    ]);
    const result = getGameResult(board);
    expect(result.status).toBe('win');
    expect(result.status === 'win' && result.winner).toBe(2);
  });

  it('未分胜负时状态为 playing', () => {
    const board = boardFrom([
      '.......',
      '.......',
      '.......',
      '.......',
      '.R.....',
      '.RY...R',
    ]);
    expect(getGameResult(board).status).toBe('playing');
  });

  it('棋盘填满且无四连时为平局', () => {
    const board = boardFrom([
      'RRYYRRY',
      'YYRRYYR',
      'RRYYRRY',
      'YYRRYYR',
      'YRRYYRR',
      'RYYRRYY',
    ]);
    expect(getGameResult(board).status).toBe('draw');
  });
});
