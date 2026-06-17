import { describe, it, expect, beforeEach } from 'vitest';
import { SprintRepository } from '../src/jira/sprint-repository.js';
import { LoggerFactory } from '../src/logging/logger-factory.js';
import type { Sprint } from '../src/domain/sprint.js';
import type { JiraClient } from '../src/jira/jira-client.js';

describe('SprintRepository.selectWindow', () => {
  let sprintRepo: SprintRepository;
  const mockClient = {} as JiraClient;

  beforeEach(() => {
    LoggerFactory.reset();
    LoggerFactory.init('silent');
    sprintRepo = new SprintRepository(
      mockClient,
      123,
      LoggerFactory.child('SprintRepository')
    );
  });

  it('should select all active sprints', () => {
    const sprints: Sprint[] = [
      { id: 1, name: 'Sprint 1', state: 'active', startDate: '2025-01-01', endDate: '2025-01-14' },
      { id: 2, name: 'Sprint 2', state: 'active', startDate: '2025-01-15', endDate: '2025-01-28' },
      { id: 3, name: 'Sprint 3', state: 'closed', startDate: '2024-12-01', endDate: '2024-12-14', completeDate: '2024-12-14' }
    ];

    const window = sprintRepo.selectWindow(sprints, 0, 0);

    expect(window).toHaveLength(2);
    expect(window.every(s => s.state === 'active')).toBe(true);
  });

  it('should select 3 most recently closed sprints by completeDate desc', () => {
    const sprints: Sprint[] = [
      { id: 1, name: 'Closed 1', state: 'closed', startDate: '2024-11-01', endDate: '2024-11-14', completeDate: '2024-11-14' },
      { id: 2, name: 'Closed 2', state: 'closed', startDate: '2024-11-15', endDate: '2024-11-28', completeDate: '2024-11-28' },
      { id: 3, name: 'Closed 3', state: 'closed', startDate: '2024-12-01', endDate: '2024-12-14', completeDate: '2024-12-14' },
      { id: 4, name: 'Closed 4', state: 'closed', startDate: '2024-12-15', endDate: '2024-12-28', completeDate: '2024-12-28' },
      { id: 5, name: 'Closed 5', state: 'closed', startDate: '2024-10-01', endDate: '2024-10-14', completeDate: '2024-10-14' }
    ];

    const window = sprintRepo.selectWindow(sprints, 3, 0);

    expect(window).toHaveLength(3);
    expect(window[0].name).toBe('Closed 4'); // Most recent
    expect(window[1].name).toBe('Closed 3');
    expect(window[2].name).toBe('Closed 2');
  });

  it('should fall back to endDate when completeDate is missing', () => {
    const sprints: Sprint[] = [
      { id: 1, name: 'Closed 1', state: 'closed', startDate: '2024-11-01', endDate: '2024-11-14' },
      { id: 2, name: 'Closed 2', state: 'closed', startDate: '2024-12-01', endDate: '2024-12-14', completeDate: '2024-12-14' }
    ];

    const window = sprintRepo.selectWindow(sprints, 2, 0);

    expect(window).toHaveLength(2);
    expect(window[0].name).toBe('Closed 2'); // Has completeDate
    expect(window[1].name).toBe('Closed 1'); // Fallback to endDate
  });

  it('should select next 3 future sprints by startDate asc', () => {
    const sprints: Sprint[] = [
      { id: 1, name: 'Future 1', state: 'future', startDate: '2025-03-01' },
      { id: 2, name: 'Future 2', state: 'future', startDate: '2025-02-01' },
      { id: 3, name: 'Future 3', state: 'future', startDate: '2025-02-15' },
      { id: 4, name: 'Future 4', state: 'future', startDate: '2025-04-01' }
    ];

    const window = sprintRepo.selectWindow(sprints, 0, 3);

    expect(window).toHaveLength(3);
    expect(window[0].name).toBe('Future 2'); // Earliest
    expect(window[1].name).toBe('Future 3');
    expect(window[2].name).toBe('Future 1');
  });

  it('should combine all active + 3 closed + 3 future', () => {
    const sprints: Sprint[] = [
      // Active
      { id: 1, name: 'Active 1', state: 'active', startDate: '2025-01-01', endDate: '2025-01-14' },
      { id: 2, name: 'Active 2', state: 'active', startDate: '2025-01-15', endDate: '2025-01-28' },
      // Closed
      { id: 3, name: 'Closed 1', state: 'closed', startDate: '2024-11-01', endDate: '2024-11-14', completeDate: '2024-11-14' },
      { id: 4, name: 'Closed 2', state: 'closed', startDate: '2024-11-15', endDate: '2024-11-28', completeDate: '2024-11-28' },
      { id: 5, name: 'Closed 3', state: 'closed', startDate: '2024-12-01', endDate: '2024-12-14', completeDate: '2024-12-14' },
      { id: 6, name: 'Closed 4', state: 'closed', startDate: '2024-10-01', endDate: '2024-10-14', completeDate: '2024-10-14' },
      // Future
      { id: 7, name: 'Future 1', state: 'future', startDate: '2025-02-01' },
      { id: 8, name: 'Future 2', state: 'future', startDate: '2025-02-15' },
      { id: 9, name: 'Future 3', state: 'future', startDate: '2025-03-01' },
      { id: 10, name: 'Future 4', state: 'future', startDate: '2025-04-01' }
    ];

    const window = sprintRepo.selectWindow(sprints, 3, 3);

    expect(window).toHaveLength(8); // 2 active + 3 closed + 3 future

    const activeCount = window.filter(s => s.state === 'active').length;
    const closedCount = window.filter(s => s.state === 'closed').length;
    const futureCount = window.filter(s => s.state === 'future').length;

    expect(activeCount).toBe(2);
    expect(closedCount).toBe(3);
    expect(futureCount).toBe(3);

    // Verify specific closed sprints (most recent 3)
    const closedNames = window.filter(s => s.state === 'closed').map(s => s.name);
    expect(closedNames).toContain('Closed 3'); // Most recent
    expect(closedNames).toContain('Closed 2');
    expect(closedNames).toContain('Closed 1');
    expect(closedNames).not.toContain('Closed 4'); // Too old

    // Verify specific future sprints (nearest 3)
    const futureNames = window.filter(s => s.state === 'future').map(s => s.name);
    expect(futureNames).toContain('Future 1'); // Nearest
    expect(futureNames).toContain('Future 2');
    expect(futureNames).toContain('Future 3');
    expect(futureNames).not.toContain('Future 4'); // Too far
  });

  it('should handle fewer sprints than requested', () => {
    const sprints: Sprint[] = [
      { id: 1, name: 'Closed 1', state: 'closed', startDate: '2024-12-01', endDate: '2024-12-14', completeDate: '2024-12-14' },
      { id: 2, name: 'Future 1', state: 'future', startDate: '2025-02-01' }
    ];

    const window = sprintRepo.selectWindow(sprints, 3, 3);

    expect(window).toHaveLength(2); // Only 1 closed + 1 future available
    expect(window.filter(s => s.state === 'closed')).toHaveLength(1);
    expect(window.filter(s => s.state === 'future')).toHaveLength(1);
  });

  it('should handle empty sprint list', () => {
    const sprints: Sprint[] = [];

    const window = sprintRepo.selectWindow(sprints, 3, 3);

    expect(window).toHaveLength(0);
  });

  it('should handle contractor sprints (they appear naturally in the window)', () => {
    const sprints: Sprint[] = [
      { id: 1, name: 'Team Sprint 1', state: 'active', startDate: '2025-01-01', endDate: '2025-01-14' },
      { id: 2, name: 'Contractor Sprint X', state: 'active', startDate: '2025-01-01', endDate: '2025-01-14' },
      { id: 3, name: 'Team Sprint 2', state: 'closed', startDate: '2024-12-01', endDate: '2024-12-14', completeDate: '2024-12-14' }
    ];

    const window = sprintRepo.selectWindow(sprints, 3, 3);

    // Both active sprints included (team + contractor)
    expect(window.filter(s => s.state === 'active')).toHaveLength(2);
    expect(window.some(s => s.name === 'Contractor Sprint X')).toBe(true);
  });
});
