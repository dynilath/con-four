import { describe, expect, it } from 'vitest';
import { chooseMove } from '../src/ai';
import {
  applyMove,
  createBoard,
  getGameResult,
  isValidMove,
  type Board,
  type Player,
} from '../src/game';
import { boardFrom, seededRng } from './helpers';

describe('简单难度', () => {
  it('不会错过眼前就能成四的落点', () => {
    const board = boardFrom([
      '.......',
      '.......',
      '.......',
      '.......',
      '.......',
      'RRYYY..',
    ]);
    const col = chooseMove(board, 2, 'easy', seededRng(1));
    expect([1, 5]).toContain(col);
  });

  it('没有直接胜机时随机选择合法列', () => {
    const board = boardFrom([
      '.......',
      '.......',
      '.......',
      '.......',
      '.RY....',
      '.RY.R..',
    ]);
    for (let seed = 0; seed < 30; seed++) {
      const col = chooseMove(board, 2, 'easy', seededRng(seed));
      expect(col).toBeGreaterThanOrEqual(0);
      expect(col).toBeLessThanOrEqual(6);
      expect(isValidMove(board, col)).toBe(true);
    }
  });
});

describe('普通难度', () => {
  it('自己能连四时立即取胜', () => {
    const board = boardFrom([
      '.......',
      '.......',
      '.......',
      '.......',
      '.......',
      'YYY.RR.',
    ]);
    expect(chooseMove(board, 2, 'medium')).toBe(3);
  });

  it('会封堵对手即将连成的四', () => {
    const board = boardFrom([
      '.......',
      '.......',
      '.......',
      '.......',
      '.......',
      'RRR.Y..',
    ]);
    expect(chooseMove(board, 2, 'medium')).toBe(3);
  });

  it('不会把棋子垫在让对手直接获胜的位置', () => {
    // 红方在第 4 行（倒数第二行）横向三连，成四点是 (4,0) 与 (4,4)，
    // 但这两点下方还是空的：黄方若往第 0/4 列落子，会垫高让对方落成四连
    const board = boardFrom([
      '.......',
      '.......',
      '.......',
      '.......',
      '.RRR...',
      '.RYY..Y',
    ]);
    const col = chooseMove(board, 2, 'medium');
    expect([0, 4]).not.toContain(col);
  });
});

describe('困难难度', () => {
  // 困难 AI 使用时间预算时搜索深度会随负载浮动，
  // 功能性断言统一传 Infinity（深度恒为 13）以获得确定性行为
  const hard = (board: Parameters<typeof chooseMove>[0], player: Parameters<typeof chooseMove>[1], rng = seededRng(7)) =>
    chooseMove(board, player, 'hard', rng, { hardTimeBudgetMs: Infinity });

  it('开局首选中路', () => {
    expect(hard(createBoard(), 1)).toBe(3);
  }, 120000);

  it('能连四时立即取胜（纵向）', () => {
    const board = boardFrom([
      '.......',
      '.......',
      '.......',
      '..Y....',
      '..Y....',
      '..Y....',
    ]);
    expect(hard(board, 2)).toBe(2);
  }, 120000);

  it('能封堵对手横向三连', () => {
    const board = boardFrom([
      '.......',
      '.......',
      '.......',
      '.......',
      '.......',
      'RRR.Y..',
    ]);
    expect(hard(board, 2)).toBe(3);
  }, 120000);

  it('能找到制造双向威胁的两步制胜', () => {
    // 黄方落第 3 列后，第 5 行形成 1-3 三连，左右（第 0、4 列）皆可成四，
    // 红方一手只能堵一边——这是两步强制取胜
    const board = boardFrom([
      '.......',
      '.......',
      '.......',
      '.......',
      '.......',
      '.YY..RR',
    ]);
    expect(hard(board, 2, seededRng(3))).toBe(3);
  }, 120000);

  it('空棋盘上的搜索耗时可接受（默认 900ms 时间预算）', () => {
    const board = createBoard();
    const start = performance.now();
    const col = chooseMove(board, 1, 'hard', seededRng(5));
    const elapsed = performance.now() - start;
    console.log(`困难 AI 开局搜索耗时 ${elapsed.toFixed(0)}ms`);
    expect(col).toBe(3);
    expect(elapsed).toBeLessThan(3000);
  }, 10000);
});

describe('难度分层（AI 对战 AI，随机种子确定化）', () => {
  function selfPlay(
    first: 'easy' | 'medium' | 'hard',
    second: 'easy' | 'medium' | 'hard',
    seed: number,
  ): { winner: Player | null; moves: number } {
    const rng = seededRng(seed);
    // 困难 AI 固定深度 11 且不限时，保证对局结果不随机器负载浮动
    const optionsFor = (d: 'easy' | 'medium' | 'hard') =>
      d === 'hard' ? { hardTimeBudgetMs: Infinity, hardMaxDepth: 11 } : undefined;
    let board: Board = createBoard();
    let turn: Player = 1;
    let moves = 0;
    for (;;) {
      const difficulty = turn === 1 ? first : second;
      const col = chooseMove(board, turn, difficulty, rng, optionsFor(difficulty));
      const moved = applyMove(board, col, turn);
      expect(moved).not.toBeNull();
      board = moved!.board;
      moves++;
      const result = getGameResult(board);
      if (result.status === 'win') return { winner: result.winner, moves };
      if (result.status === 'draw') return { winner: null, moves };
      turn = turn === 1 ? 2 : 1;
    }
  }

  it('普通 AI 战胜简单 AI', () => {
    const { winner } = selfPlay('medium', 'easy', 11);
    expect(winner).toBe(1);
  }, 60000);

  it('困难 AI 先手、后手均战胜简单 AI', () => {
    expect(selfPlay('hard', 'easy', 42).winner).toBe(1);
    expect(selfPlay('easy', 'hard', 42).winner).toBe(2);
  }, 180000);

  it('困难 AI 对普通 AI 六战全胜（先/后手 × 三组种子）', () => {
    for (const seed of [23, 37, 101]) {
      expect(selfPlay('hard', 'medium', seed).winner).toBe(1);
      expect(selfPlay('medium', 'hard', seed).winner).toBe(2);
    }
  }, 300000);
});
