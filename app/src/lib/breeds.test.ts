import { describe, expect, it } from 'vitest';
import { suggestBreeds } from './breeds';

describe('suggestBreeds', () => {
  it('suggests nothing until something is typed', () => {
    expect(suggestBreeds('Dog', '  ')).toEqual([]);
  });

  it('puts word-start matches first', () => {
    const r = suggestBreeds('Dog', 'spaniel', 20);
    expect(r).toContain('English Springer Spaniel');
    expect(r).toContain('Cavalier King Charles Spaniel');
  });

  it('ignores case and accents', () => {
    expect(suggestBreeds('Dog', 'bichon frise')).toContain('Bichon Frisé');
  });

  it('includes common UK crossbreeds', () => {
    expect(suggestBreeds('Dog', 'cocka')).toContain('Cockapoo');
  });

  it('uses the right list per species and none for Other', () => {
    expect(suggestBreeds('Cat', 'main')[0]).toMatch(/Maine Coon/);
    expect(suggestBreeds('Other', 'lab')).toEqual([]);
  });

  it('stops suggesting once a breed is typed in full', () => {
    expect(suggestBreeds('Dog', 'Border Collie')).not.toContain('Border Collie');
  });
});
