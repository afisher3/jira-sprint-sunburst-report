import { describe, it, expect } from 'vitest';
import { ClassificationParser } from '../src/domain/classification-parser.js';

describe('ClassificationParser', () => {
  it('should parse normal two-level classification', () => {
    const result = ClassificationParser.parse('App Dev -> New Feature');

    expect(result.level1).toBe('App Dev');
    expect(result.level2).toBe('New Feature');
  });

  it('should handle null value', () => {
    const result = ClassificationParser.parse(null);

    expect(result.level1).toBe('Unclassified');
    expect(result.level2).toBe('Unspecified');
  });

  it('should handle undefined value', () => {
    const result = ClassificationParser.parse(undefined);

    expect(result.level1).toBe('Unclassified');
    expect(result.level2).toBe('Unspecified');
  });

  it('should handle empty string', () => {
    const result = ClassificationParser.parse('');

    expect(result.level1).toBe('Unclassified');
    expect(result.level2).toBe('Unspecified');
  });

  it('should handle whitespace-only string', () => {
    const result = ClassificationParser.parse('   ');

    expect(result.level1).toBe('Unclassified');
    expect(result.level2).toBe('Unspecified');
  });

  it('should handle level1-only (no arrow)', () => {
    const result = ClassificationParser.parse('App Dev');

    expect(result.level1).toBe('App Dev');
    expect(result.level2).toBe('Unspecified');
  });

  it('should handle level1-only (with arrow but no level2)', () => {
    const result = ClassificationParser.parse('Security -> ');

    expect(result.level1).toBe('Security');
    expect(result.level2).toBe('Unspecified');
  });

  it('should trim whitespace around parts', () => {
    const result = ClassificationParser.parse('  Infrastructure  ->  Bug Fix  ');

    expect(result.level1).toBe('Infrastructure');
    expect(result.level2).toBe('Bug Fix');
  });

  it('should handle level2 with slashes and special characters', () => {
    const result = ClassificationParser.parse('App Dev -> Enhancement / Improvement');

    expect(result.level1).toBe('App Dev');
    expect(result.level2).toBe('Enhancement / Improvement');
  });

  it('should handle multiple arrows in level2 (edge case)', () => {
    const result = ClassificationParser.parse('Level1 -> Level2 -> Level3');

    expect(result.level1).toBe('Level1');
    // Remaining parts should be joined back together
    expect(result.level2).toBe('Level2 -> Level3');
  });

  it('should handle classifications with numbers', () => {
    const result = ClassificationParser.parse('Sprint 123 -> Task 456');

    expect(result.level1).toBe('Sprint 123');
    expect(result.level2).toBe('Task 456');
  });

  it('should handle odd spacing around separator', () => {
    const result = ClassificationParser.parse('Test->NoSpace');

    // Won't match separator exactly, so treats as level1 only
    expect(result.level1).toBe('Test->NoSpace');
    expect(result.level2).toBe('Unspecified');
  });

  it('should match exact separator format', () => {
    const result = ClassificationParser.parse('Test ->Partial Space');

    // Won't match " -> " exactly
    expect(result.level1).toBe('Test ->Partial Space');
    expect(result.level2).toBe('Unspecified');
  });
});
