import { describe, it, expect } from 'vitest';
import { parseAmount, parsePercentage } from '../../src/utils/parse';

describe('parseAmount', () => {
  it('parses plain integers', () => {
    expect(parseAmount('3000')).toBe(3000);
    expect(parseAmount('0')).toBe(0);
  });

  it('parses pt-BR currency formatting', () => {
    expect(parseAmount('R$ 3.000,00')).toBe(3000);
    expect(parseAmount('R$ 1.234,56')).toBe(1234.56);
    expect(parseAmount('1500,50')).toBe(1500.5);
  });

  it('parses dot as decimal when no comma is present', () => {
    expect(parseAmount('3000.50')).toBe(3000.5);
  });

  it('rejects non-numeric input', () => {
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('R$')).toBeNull();
  });

  it('rejects negative values', () => {
    expect(parseAmount('-100')).toBeNull();
  });
});

describe('parsePercentage', () => {
  it('parses with and without %', () => {
    expect(parsePercentage('20')).toBe(20);
    expect(parsePercentage('20%')).toBe(20);
    expect(parsePercentage('20 %')).toBe(20);
    expect(parsePercentage('0')).toBe(0);
    expect(parsePercentage('100')).toBe(100);
  });

  it('rejects values out of 0-100 range', () => {
    expect(parsePercentage('150')).toBeNull();
    expect(parsePercentage('-5')).toBeNull();
  });

  it('rejects garbage', () => {
    expect(parsePercentage('high')).toBeNull();
  });
});
