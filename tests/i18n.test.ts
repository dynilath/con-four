import { describe, expect, it } from 'vitest';
import {
  LANGS,
  detectLanguage,
  formatScore,
  getMessages,
  isLang,
  type Lang,
  type Messages,
} from '../src/i18n';

describe('isLang', () => {
  it('接受 en/zh/ja，拒绝其它值', () => {
    expect(isLang('en')).toBe(true);
    expect(isLang('zh')).toBe(true);
    expect(isLang('ja')).toBe(true);
    expect(isLang('fr')).toBe(false);
    expect(isLang(null)).toBe(false);
    expect(isLang(undefined)).toBe(false);
    expect(isLang('')).toBe(false);
  });
});

describe('detectLanguage：根据浏览器语言自动选择', () => {
  it('zh 前缀（含地区变体）识别为中文', () => {
    expect(detectLanguage(null, ['zh-CN'])).toBe('zh');
    expect(detectLanguage(undefined, ['zh-TW'])).toBe('zh');
  });

  it('ja 前缀识别为日文', () => {
    expect(detectLanguage(null, ['ja-JP'])).toBe('ja');
  });

  it('en 前缀识别为英文', () => {
    expect(detectLanguage(null, ['en-US'])).toBe('en');
  });

  it('无法识别的语言回退英文', () => {
    expect(detectLanguage(null, ['fr-FR'])).toBe('en');
    expect(detectLanguage(null, ['de-DE', 'ko-KR'])).toBe('en');
  });

  it('按候选列表顺序取第一个可识别语言', () => {
    expect(detectLanguage(null, ['fr-FR', 'ja-JP', 'zh-CN'])).toBe('ja');
    expect(detectLanguage(null, ['zh-CN', 'ja-JP'])).toBe('zh');
  });

  it('手动选择优先于浏览器语言', () => {
    expect(detectLanguage('ja', ['en-US', 'zh-CN'])).toBe('ja');
    expect(detectLanguage('en', ['zh-CN'])).toBe('en');
  });

  it('非法的手动选择被忽略，仍按浏览器语言', () => {
    expect(detectLanguage('de', ['zh-CN'])).toBe('zh');
    expect(detectLanguage('', ['ja-JP'])).toBe('ja');
  });

  it('候选列表为空时回退英文', () => {
    expect(detectLanguage(null, [])).toBe('en');
  });
});

describe('词典完整性', () => {
  it('三种语言覆盖完全相同的键', () => {
    const base = Object.keys(getMessages('en')).sort();
    for (const lang of LANGS as readonly Lang[]) {
      expect(Object.keys(getMessages(lang)).sort()).toEqual(base);
    }
  });

  it('所有文案均为非空字符串', () => {
    for (const lang of LANGS as readonly Lang[]) {
      const messages: Messages = getMessages(lang);
      for (const [key, value] of Object.entries(messages)) {
        expect(typeof value, `${lang}.${key}`).toBe('string');
        expect(value.length, `${lang}.${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('占位符格式统一：scoreFormat 均含 {win}/{loss}/{draw}', () => {
    for (const lang of LANGS as readonly Lang[]) {
      const format = getMessages(lang).scoreFormat;
      expect(format).toContain('{win}');
      expect(format).toContain('{loss}');
      expect(format).toContain('{draw}');
    }
  });
});

describe('formatScore', () => {
  it('替换比分占位符', () => {
    expect(formatScore('zh', 1, 2, 3)).toBe('你 1 : 2 AI · 平 3');
    expect(formatScore('en', 1, 2, 3)).toBe('You 1 : 2 AI · Draws 3');
    expect(formatScore('ja', 1, 2, 3)).toBe('あなた 1 : 2 AI · 引分 3');
  });
});
