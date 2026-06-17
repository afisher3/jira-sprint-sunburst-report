import type { Logger } from 'pino';

/**
 * JiraClient — thin HTTP wrapper for Jira Cloud APIs with OAuth 2.0 authentication.
 * Handles auth, retries, and pagination. Keeps business logic out (that's in repositories).
 */
export class JiraClient {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private cloudId: string | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly logger: Logger
  ) {}

  /**
   * Ensure we have a valid OAuth access token, refreshing if needed.
   */
  private async ensureAuth(): Promise<void> {
    const now = Date.now();

    // If token exists and hasn't expired (with 60s buffer), reuse it
    if (this.accessToken && now < this.tokenExpiry - 60000) {
      return;
    }

    this.logger.debug('Obtaining OAuth access token');

    try {
      // OAuth 2.0 Client Credentials flow
      const tokenUrl = 'https://auth.atlassian.com/oauth/token';
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          audience: 'api.atlassian.com'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OAuth token request failed (${response.status}): ${errorText}`);
      }

      const tokenData = await response.json() as { access_token: string; expires_in: number };
      this.accessToken = tokenData.access_token;
      this.tokenExpiry = now + (tokenData.expires_in * 1000);

      this.logger.info({ expiresIn: tokenData.expires_in }, 'OAuth access token obtained');

      // Get cloud ID from accessible resources
      await this.ensureCloudId();
    } catch (error) {
      this.logger.error({ error }, 'Failed to obtain OAuth access token');
      throw new Error(`OAuth authentication failed: ${(error as Error).message}`);
    }
  }

  /**
   * Get the Jira cloud ID for the configured baseUrl.
   * Required for OAuth 2.0 API gateway URLs.
   */
  private async ensureCloudId(): Promise<void> {
    if (this.cloudId) {
      return;
    }

    this.logger.debug('Fetching Jira cloud ID');

    try {
      const response = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get accessible resources (${response.status}): ${errorText}`);
      }

      const resources = await response.json() as Array<{ id: string; url: string; name: string }>;

      // Find the resource matching our baseUrl
      const resource = resources.find(r => r.url === this.baseUrl);
      if (!resource) {
        throw new Error(`No accessible Jira resource found for ${this.baseUrl}. Available: ${resources.map(r => r.url).join(', ')}`);
      }

      this.cloudId = resource.id;
      this.logger.info({ cloudId: this.cloudId, siteName: resource.name }, 'Jira cloud ID obtained');
    } catch (error) {
      this.logger.error({ error }, 'Failed to get Jira cloud ID');
      throw new Error(`Failed to get cloud ID: ${(error as Error).message}`);
    }
  }

  /**
   * Make an authenticated GET request to a Jira Agile API endpoint.
   * @param path - API path (e.g., /rest/agile/1.0/board/123/sprint)
   * @param params - Query parameters
   * @returns Parsed JSON response
   */
  async agileGet<T = unknown>(path: string, params?: Record<string, string | number>): Promise<T> {
    await this.ensureAuth();

    // Use API gateway URL with cloud ID
    const apiPath = path.startsWith('/') ? path : `/${path}`;
    const fullUrl = `https://api.atlassian.com/ex/jira/${this.cloudId}${apiPath}`;
    const url = new URL(fullUrl);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    this.logger.debug({ url: url.toString() }, 'Agile API GET request');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error({ status: response.status, path, errorText }, 'Agile API request failed');

      if (response.status === 401 || response.status === 403) {
        throw new Error(`Authentication failed (${response.status}). Check OAuth credentials.`);
      }
      throw new Error(`Jira API request failed (${response.status}): ${errorText}`);
    }

    const data = await response.json() as T;
    return data;
  }

  /**
   * Search issues using JQL via the platform search API with nextPageToken pagination.
   * @param jql - JQL query string
   * @param fields - Array of field names to return
   * @param nextPageToken - Optional pagination token
   * @returns Parsed JSON response with issues and next page token
   */
  async searchJql<T = unknown>(
    jql: string,
    fields: string[],
    nextPageToken?: string
  ): Promise<T> {
    await this.ensureAuth();

    // Use API gateway URL with cloud ID
    const fullUrl = `https://api.atlassian.com/ex/jira/${this.cloudId}/rest/api/3/search/jql`;
    const url = new URL(fullUrl);

    const body: Record<string, unknown> = {
      jql,
      fields
    };

    if (nextPageToken) {
      body.nextPageToken = nextPageToken;
    }

    this.logger.debug({ jql, fields, hasNextToken: !!nextPageToken }, 'Platform search request');

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error({ status: response.status, jql, errorText }, 'Search request failed');

      if (response.status === 401 || response.status === 403) {
        throw new Error(`Authentication failed (${response.status}). Check OAuth credentials.`);
      }
      throw new Error(`Jira search failed (${response.status}): ${errorText}`);
    }

    const data = await response.json() as T;
    return data;
  }
}
