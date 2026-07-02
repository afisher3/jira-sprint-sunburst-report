import { z } from 'zod';

/**
 * Zod schema for the application configuration.
 * Validates structure and types, fails loudly on invalid config.
 */

export const JiraConfigSchema = z.object({
  baseUrl: z.string().url('baseUrl must be a valid URL'),
  boardId: z.number().int().positive('boardId must be a positive integer'),
  storyPointsFieldId: z.string().min(1, 'storyPointsFieldId must not be empty'),
  classificationFieldId: z.string().min(1, 'classificationFieldId must not be empty'),
  qaFailCountFieldId: z.string().min(1, 'qaFailCountFieldId must not be empty'),
  uatFailCountFieldId: z.string().min(1, 'uatFailCountFieldId must not be empty'),
  // OAuth authentication (clientId and clientSecret come from env vars)
  authType: z.enum(['oauth']).default('oauth')
});

export const WindowConfigSchema = z.object({
  closed: z.number().int().min(0, 'window.closed must be >= 0').default(3),
  future: z.number().int().min(0, 'window.future must be >= 0').default(3)
});

export const TargetClassificationSchema = z.object({
  level1: z.string().min(1, 'level1 must not be empty'),
  level2: z.string().min(1, 'level2 must not be empty'),
  percentage: z.number().min(0).max(100, 'percentage must be between 0 and 100')
});

export const ReportConfigSchema = z.object({
  showEmptyCategories: z.boolean().default(false),
  targetClassifications: z.array(TargetClassificationSchema).optional().default([])
});

export const OutputConfigSchema = z.object({
  type: z.enum(['local', 'confluence'], {
    errorMap: () => ({ message: 'output.type must be "local" or "confluence"' })
  }),
  path: z.string().min(1, 'output.path must not be empty').optional()
}).refine(
  (data) => {
    if (data.type === 'local' && !data.path) {
      return false;
    }
    return true;
  },
  {
    message: 'output.path is required when output.type is "local"',
    path: ['path']
  }
);

export const ConfigSchema = z.object({
  jira: JiraConfigSchema,
  window: WindowConfigSchema.default({ closed: 3, future: 3 }),
  report: ReportConfigSchema.default({ showEmptyCategories: false }),
  output: OutputConfigSchema,
  logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info')
});

export type ConfigType = z.infer<typeof ConfigSchema>;
