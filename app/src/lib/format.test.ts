import { describe, expect, it } from 'vitest';
import { formatUkDateInput, isoToUk, ukToIso } from './format';
import { passwordRules, passwordValid } from './password';

describe('UK dates', () => {
  it('converts between DD-MM-YYYY and the API format', () => {
    expect(isoToUk('2026-03-01')).toBe('01-03-2026');
    expect(ukToIso('01-03-2026')).toBe('2026-03-01');
    expect(isoToUk(null)).toBe('');
  });

  it('rejects incomplete or impossible dates', () => {
    expect(ukToIso('01-03-26')).toBeNull();
    expect(ukToIso('31-02-2026')).toBeNull();
    expect(ukToIso('2026-03-01')).toBeNull();
  });

  it('adds dashes as digits are typed', () => {
    expect(formatUkDateInput('0')).toBe('0');
    expect(formatUkDateInput('0103')).toBe('01-03');
    expect(formatUkDateInput('010320')).toBe('01-03-20');
    expect(formatUkDateInput('01032026')).toBe('01-03-2026');
    expect(formatUkDateInput('01/03/2026')).toBe('01-03-2026');
    expect(formatUkDateInput('010320269')).toBe('01-03-2026');
  });
});

describe('password rules', () => {
  it('mirrors the Cognito policy', () => {
    expect(passwordValid('short1')).toBe(false);
    expect(passwordValid('NOLOWERCASE123')).toBe(false);
    expect(passwordValid('nonumbershere')).toBe(false);
    expect(passwordValid(' leadingspace1')).toBe(false);
    expect(passwordValid('good password 1')).toBe(true);
    expect(passwordValid('Symbols!£$%^&*()9a')).toBe(true);
  });

  it('reports which rules are met', () => {
    expect(passwordRules('abc').map((r) => r.met)).toEqual([false, true, false, true]);
  });
});
