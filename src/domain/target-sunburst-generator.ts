import type { TargetClassification } from '../config/app-config.js';
import { getCategoryId } from './sunburst-aggregator.js';
import type { SunburstDataset } from './sunburst-dataset.js';

/**
 * TargetSunburstGenerator — generates a target/ideal sunburst dataset from configured percentages.
 * Uses a fixed total of 100 points to represent percentages as actual values.
 */
export class TargetSunburstGenerator {
  /**
   * Generate a target sunburst dataset from target classification percentages.
   * @param targetClassifications - Array of target classifications with percentages
   * @returns SunburstDataset representing the ideal distribution
   */
  static generate(targetClassifications: TargetClassification[]): SunburstDataset {
    if (targetClassifications.length === 0) {
      // Return empty dataset if no target classifications configured
      return {
        ids: [],
        labels: [],
        parents: [],
        values: [],
        issueCount: 0
      };
    }

    // Sort classifications alphabetically so they are in the same order as the other chart
    const sortedClassifications = [...targetClassifications].sort(
      (a, b)=> a.level1.localeCompare(b.level1)
    )

    const ids: string[] = [];
    const labels: string[] = [];
    const parents: string[] = [];
    const values: number[] = [];

    // Group by level1 to build hierarchy
    const level1Map = new Map<string, { level2Items: Array<{ level2: string; percentage: number }> }>();

    for (const target of sortedClassifications) {
      if (!level1Map.has(target.level1)) {
        level1Map.set(target.level1, { level2Items: [] });
      }
      level1Map.get(target.level1)!.level2Items.push({
        level2: target.level2,
        percentage: target.percentage
      });
    }

    // Build level 1 nodes first
    for (const [level1Name, data] of level1Map.entries()) {
      const level1Id = this.makeId(level1Name);
      const level1Total = data.level2Items.reduce((sum, item) => sum + item.percentage, 0);

      ids.push(level1Id);
      labels.push(level1Name);
      parents.push('');
      values.push(level1Total);
    }

    if (values.reduce((cur, num) => cur + num, 0) != 100){
      throw new Error("Target Classification percentages don't add up to 100");
    }

    // Build level 2 nodes
    for (const [level1Name, data] of level1Map.entries()) {
      const level1Id = this.makeId(level1Name);

      for (const item of data.level2Items) {
        const level2Id = getCategoryId(level1Id,this.makeId(item.level2));
        ids.push(level2Id);
        labels.push(item.level2);
        parents.push(level1Id);
        values.push(item.percentage);
      }
    }



    return {
      ids,
      labels,
      parents,
      values,
      issueCount: 0 // Target doesn't have actual issues
    };
  }

  /**
   * Create a stable ID from a label by removing spaces and special characters.
   */
  private static makeId(label: string): string {
    return label.replace(/[^a-zA-Z0-9]/g, '');
  }
}
