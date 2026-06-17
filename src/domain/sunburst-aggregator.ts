import type { Issue } from './issue.js';
import type { SunburstDataset } from './sunburst-dataset.js';

interface CategoryKey {
  level1: string;
  level2: string;
}

interface CategoryData {
  key: CategoryKey;
  storyPoints: number;
}

/**
 * SunburstAggregator — groups issues by classification and sums story points.
 * Outputs Plotly-compatible sunburst dataset.
 */
export class SunburstAggregator {
  /**
   * Aggregate issues into a sunburst dataset.
   * @param issues - Issues with classifications and story points
   * @param showEmptyCategories - Include categories with zero points (future feature)
   * @returns Plotly sunburst dataset
   */
  static aggregate(issues: Issue[], showEmptyCategories = false): SunburstDataset {
    // Group by (level1, level2) and sum story points
    const categoryMap = new Map<string, CategoryData>();

    for (const issue of issues) {
      const { level1, level2 } = issue.classification;
      const categoryId = `${level1}|${level2}`;

      const existing = categoryMap.get(categoryId);
      if (existing) {
        existing.storyPoints += issue.storyPoints;
      } else {
        categoryMap.set(categoryId, {
          key: { level1, level2 },
          storyPoints: issue.storyPoints
        });
      }
    }

    // Extract unique level1 categories and their totals
    const level1Map = new Map<string, number>();
    for (const category of categoryMap.values()) {
      const existing = level1Map.get(category.key.level1) || 0;
      level1Map.set(category.key.level1, existing + category.storyPoints);
    }

    // Build Plotly dataset
    const ids: string[] = [];
    const labels: string[] = [];
    const parents: string[] = [];
    const values: number[] = [];

    // Add level 1 nodes
    for (const [level1, totalPoints] of level1Map.entries()) {
      ids.push(level1);
      labels.push(level1);
      parents.push('');  // Root level
      values.push(totalPoints);
    }

    // Add level 2 nodes
    for (const category of categoryMap.values()) {
      const { level1, level2 } = category.key;
      const id = `${level1}|${level2}`;

      ids.push(id);
      labels.push(level2);
      parents.push(level1);  // Parent is level1
      values.push(category.storyPoints);
    }

    return {
      ids,
      labels,
      parents,
      values,
      issueCount: issues.length
    };
  }
}
