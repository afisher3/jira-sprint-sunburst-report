/**
 * OutputTarget — interface for writing report output.
 * Abstracts the destination (local file, S3, Confluence, etc.) so the renderer stays clean.
 * Enables easy Lambda transition later.
 */
export interface OutputTarget {
  /**
   * Write the HTML report to the target destination.
   * @param html - The complete HTML content to write
   * @param name - The report name/identifier (used for filename, page title, etc.)
   * @returns Promise that resolves when write completes
   * @throws Error if write fails
   */
  write(html: string, name: string): Promise<void>;
}
