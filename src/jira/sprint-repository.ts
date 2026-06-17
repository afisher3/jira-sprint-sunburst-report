import type { Logger } from 'pino';
import type { JiraClient } from './jira-client.js';
import type { Sprint } from '../domain/sprint.js';

interface JiraSprintResponse {
  maxResults: number;
  startAt: number;
  isLast: boolean;
  values: Array<{
    id: number;
    name: string;
    state: string;
    startDate?: string;
    endDate?: string;
    completeDate?: string;
  }>;
}

/**
 * SprintRepository — fetches sprint metadata from Jira and applies window selection logic.
 * Cost control: only fetches metadata, never issues, until the window is determined.
 */
export class SprintRepository {
  constructor(
    private readonly client: JiraClient,
    private readonly boardId: number,
    private readonly logger: Logger
  ) {}

  /**
   * Discover all sprints on the board, paginating through results.
   * @returns All sprints (active, closed, future) with metadata only
   */
  async discoverSprints(): Promise<Sprint[]> {
    this.logger.info({ boardId: this.boardId }, 'Discovering sprints');

    const allSprints: Sprint[] = [];
    let startAt = 0;
    const maxResults = 50;

    while (true) {
      const path = `/rest/agile/1.0/board/${this.boardId}/sprint`;
      const response = await this.client.agileGet<JiraSprintResponse>(path, {
        startAt,
        maxResults
      });

      const sprints = response.values.map(s => this.mapSprint(s));
      allSprints.push(...sprints);

      this.logger.debug({
        retrieved: sprints.length,
        total: allSprints.length,
        isLast: response.isLast
      }, 'Sprint batch retrieved');

      if (response.isLast) {
        break;
      }

      startAt += maxResults;
    }

    this.logger.info({ total: allSprints.length }, 'Sprint discovery complete');
    return allSprints;
  }

  /**
   * Select the sprint window according to the spec:
   * - All active sprints
   * - 3 most recently closed (by completeDate desc, fallback endDate)
   * - Next 3 future (by startDate asc)
   *
   * @param sprints - All sprints from discoverSprints
   * @param closedCount - Number of closed sprints to include
   * @param futureCount - Number of future sprints to include
   * @returns Windowed sprint list
   */
  selectWindow(sprints: Sprint[], closedCount: number, futureCount: number): Sprint[] {
    this.logger.debug({
      totalSprints: sprints.length,
      closedCount,
      futureCount
    }, 'Selecting sprint window');

    // Separate by state
    const active = sprints.filter(s => s.state === 'active');
    const closed = sprints.filter(s => s.state === 'closed');
    const future = sprints.filter(s => s.state === 'future');

    // Sort closed by completeDate desc (most recent first), fallback to endDate
    const sortedClosed = closed.sort((a, b) => {
      const dateA = a.completeDate || a.endDate || '';
      const dateB = b.completeDate || b.endDate || '';
      return dateB.localeCompare(dateA); // desc order
    });

    // Sort future by startDate asc (nearest first)
    const sortedFuture = future.sort((a, b) => {
      const dateA = a.startDate || '';
      const dateB = b.startDate || '';
      return dateA.localeCompare(dateB); // asc order
    });

    // Select window
    const selectedClosed = sortedClosed.slice(0, closedCount);
    const selectedFuture = sortedFuture.slice(0, futureCount);

    const window = [...active, ...selectedClosed, ...selectedFuture];

    this.logger.info({
      active: active.length,
      closed: selectedClosed.length,
      future: selectedFuture.length,
      total: window.length
    }, 'Sprint window selected');

    return window;
  }

  private mapSprint(jiraSprint: JiraSprintResponse['values'][0]): Sprint {
    // Normalize state to our enum
    let state: Sprint['state'];
    if (jiraSprint.state === 'active') {
      state = 'active';
    } else if (jiraSprint.state === 'closed') {
      state = 'closed';
    } else {
      state = 'future';
    }

    return {
      id: jiraSprint.id,
      name: jiraSprint.name,
      state,
      startDate: jiraSprint.startDate,
      endDate: jiraSprint.endDate,
      completeDate: jiraSprint.completeDate
    };
  }
}
