import { describe, it, expect } from 'vitest';
import { parseCSV, detectDelimiter, validateCSVFile } from './csv-parser';

describe('CSV Parser', () => {
  describe('parseCSV', () => {
    it('parses standard CSV', () => {
      const csv = 'name,age\nJohn,30\nJane,25';
      const result = parseCSV(csv);
      expect(result.headers).toEqual(['name', 'age']);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].name).toBe('John');
      expect(result.rows[0].age).toBe('30');
    });

    it('handles BOM', () => {
      const csv = '\uFEFFname,age\nJohn,30';
      const result = parseCSV(csv);
      expect(result.headers).toEqual(['name', 'age']);
    });

    it('handles quoted values', () => {
      const csv = 'name,comment\nJohn,"Hello, World"';
      const result = parseCSV(csv);
      expect(result.rows[0].comment).toBe('Hello, World');
    });

    it('handles semicolon delimiter', () => {
      const csv = 'name;age\nJohn;30';
      const result = parseCSV(csv, { delimiter: ';' });
      expect(result.headers).toEqual(['name', 'age']);
      expect(result.rows[0].age).toBe('30');
    });

    it('skips empty lines', () => {
      const csv = 'name,age\nJohn,30\n\nJane,25\n';
      const result = parseCSV(csv, { skipEmptyLines: true });
      expect(result.rows).toHaveLength(2);
    });
  });

  describe('detectDelimiter', () => {
    it('detects comma', () => {
      const csv = 'a,b,c\n1,2,3';
      expect(detectDelimiter(csv)).toBe(',');
    });

    it('detects semicolon', () => {
      const csv = 'a;b;c\n1;2;3';
      expect(detectDelimiter(csv)).toBe(';');
    });

    it('detects tab', () => {
      const csv = 'a\tb\tc\n1\t2\t3';
      expect(detectDelimiter(csv)).toBe('\t');
    });
  });

  describe('validateCSVFile', () => {
    it('rejects non-CSV files', () => {
      const file = new File([''], 'test.txt', { type: 'text/plain' });
      const result = validateCSVFile(file);
      expect(result.valid).toBe(false);
    });

    it('rejects empty files', () => {
      const file = new File([''], 'test.csv', { type: 'text/csv' });
      const result = validateCSVFile(file);
      expect(result.valid).toBe(false);
    });

    it('accepts valid CSV files', () => {
      const file = new File(['a,b\n1,2'], 'test.csv', { type: 'text/csv' });
      const result = validateCSVFile(file);
      expect(result.valid).toBe(true);
    });
  });
});
