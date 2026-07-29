import type { Classification } from './classification.js';

/**
 * ClassificationParser — parses Jira cascading select field into two-level classification.
 *
 * Jira's cascading select fields can be returned in two formats:
 * 1. String format (CSV exports): "Level 1 -> Level 2"
 * 2. Object format (API): { value: "Level 1", child: { value: "Level 2" } }
 *
 * Rules (per spec):
 * 1. If null/empty → { level1: "Unclassified", level2: "Unspecified" }
 * 2. If object format: extract value and child.value
 * 3. If string format: split on " -> ", trim each part
 * 4. level1 = first part/value
 * 5. level2 = second part/child.value or "Unspecified" if missing
 */
export class ClassificationParser {
  private static readonly SEPARATOR = ' -> ';
  private static readonly DEFAULT_LEVEL1 = 'Unclassified';
  private static readonly DEFAULT_LEVEL2 = 'Unspecified';

  /**
   * Parse raw classification field from Jira.
   * @param raw - Raw field value (can be null, string, or cascading select object)
   * @returns Parsed classification with level1 and level2
   */
  static parse(raw: string | CascadingSelectValue | null | undefined): Classification {
    // Rule 1: null/empty → defaults
    if (!raw) {
      return {
        level1: this.DEFAULT_LEVEL1,
        level2: this.DEFAULT_LEVEL2
      };
    }

    // Handle object format (cascading select from API)
    if (typeof raw === 'object' && 'value' in raw) {
      const level1 = raw.value || this.DEFAULT_LEVEL1;
      const level2 = raw.child?.value || this.DEFAULT_LEVEL2;
      return { level1, level2 };
    }

    // Handle string format (CSV export or manual string)
    if (typeof raw === 'string') {

      // Split on " -> " and trim
      const parts = raw.split(this.SEPARATOR).map(p => p.trim());
      if (raw.trim() === '') {
        return {
          level1: this.DEFAULT_LEVEL1,
          level2: this.DEFAULT_LEVEL2
        };
      }

      // level1 is always first part
      const level1 = parts[0] || this.DEFAULT_LEVEL1;

      // level2 handling
      let level2: string;
      if (parts.length > 1) {
        // Join remaining parts in case level2 itself contains " -> "
        level2 = parts.slice(1).join(this.SEPARATOR).trim();
        // If the joined result is empty, use default
        if (level2 === '') {
          level2 = this.DEFAULT_LEVEL2;
        }
      } else {
        // No second level provided
        level2 = this.DEFAULT_LEVEL2;
      }

      return { level1, level2 };
    }

    // Fallback for unexpected types
    return {
      level1: this.DEFAULT_LEVEL1,
      level2: this.DEFAULT_LEVEL2
    };
  }
}

/**
 * Type definition for Jira's cascading select field value.
 */
interface CascadingSelectValue {
  self?: string;
  value: string;
  id?: string;
  child?: {
    self?: string;
    value: string;
    id?: string;
  };
}
