import { describe, expect, it } from 'vitest';
import { csvCell, toCsv } from '../csv';

describe('CSV export', () => {
  it('escapes quotes, commas and newlines (RFC 4180)', () => {
    expect(csvCell('Bariis, iyo "hilib"')).toBe('"Bariis, iyo ""hilib"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
  });
  it('neutralises spreadsheet formula injection', () => {
    expect(csvCell('=HYPERLINK("http://evil")')).toBe(`"'=HYPERLINK(""http://evil"")"`);
    expect(csvCell('+cmd')).toBe("'+cmd");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
  });
  it('keeps numbers and negative numeric strings intact', () => {
    expect(csvCell(-12.5)).toBe('-12.5');
    expect(csvCell('-3.25')).toBe('-3.25');
    expect(csvCell(null)).toBe('');
    expect(csvCell(true)).toBe('true');
  });
  it('builds a full document with CRLF rows', () => {
    expect(
      toCsv(
        ['A', 'B'],
        [
          [1, 'x'],
          [2, null],
        ],
      ),
    ).toBe('A,B\r\n1,x\r\n2,');
  });
});
