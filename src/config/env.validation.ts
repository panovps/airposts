import { z } from 'zod';

const llmProviderSchema = z.enum(['openai', 'anthropic', 'deepseek']);

const baseEnvSchema = z.object({
  // Bot configuration (required)
  BOT_TOKEN: z.string().min(1, 'BOT_TOKEN is required'),
  BOT_USERNAME: z.string().optional(),
  BOT_ADMIN_ID: z.string().optional(),

  // Database (required)
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Server
  PORT: z.string().optional().default('3000'),

  // LLM provider (required)
  LLM_PROVIDER: llmProviderSchema,

  // LLM API keys (conditionally required based on provider)
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_MODEL: z.string().optional(),
});

export const envSchema = baseEnvSchema.superRefine((env, ctx) => {
  if (env.LLM_PROVIDER === 'openai' && !env.OPENAI_API_KEY) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'OPENAI_API_KEY is required when LLM_PROVIDER=openai',
      path: ['OPENAI_API_KEY'],
    });
  }
  if (env.LLM_PROVIDER === 'anthropic' && !env.ANTHROPIC_API_KEY) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic',
      path: ['ANTHROPIC_API_KEY'],
    });
  }
  if (env.LLM_PROVIDER === 'deepseek' && !env.DEEPSEEK_API_KEY) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'DEEPSEEK_API_KEY is required when LLM_PROVIDER=deepseek',
      path: ['DEEPSEEK_API_KEY'],
    });
  }
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  return envSchema.parse(config);
}
