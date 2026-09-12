import { deriveInitialsFromName } from './leaderboard.service';

describe('deriveInitialsFromName', () => {
  it('derives initials from two or more words', () => {
    expect(deriveInitialsFromName('Tanvir Hassan')).toBe('TH');
    expect(deriveInitialsFromName('Arif Chowdhury')).toBe('AC');
    expect(deriveInitialsFromName('John Middle Doe')).toBe('JD');
  });

  it('derives initials from single word', () => {
    expect(deriveInitialsFromName('Bashir')).toBe('BA');
    expect(deriveInitialsFromName('A')).toBe('A');
  });

  it('handles empty or whitespace strings', () => {
    expect(deriveInitialsFromName('')).toBe('?');
    expect(deriveInitialsFromName('   ')).toBe('?');
  });
});
