import { z } from "zod";

const envSchema = z
  .object({
    INTERVALS_API_KEY: z.string().min(1).optional(),
    INTERVALS_ATHLETE_ID: z.string().min(1).optional(),
    DEFAULT_TIMEZONE: z.string().default("Europe/Paris"),
    DATA_SOURCE: z.enum(["intervals", "fixtures"]).default("fixtures"),
    MAX_HISTORY_DAYS: z.coerce.number().int().min(1).max(90).default(42),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    ATHLETE_ID: z.string().trim().min(1).max(120).default("primary"),
    ATHLETE_PROFILE_JSON: z.string().min(2).optional(),
  })
  .superRefine((value, context) => {
    if (value.DATA_SOURCE !== "intervals") return;
    if (!value.INTERVALS_API_KEY) {
      context.addIssue({
        code: "custom",
        path: ["INTERVALS_API_KEY"],
        message: "INTERVALS_API_KEY is required when DATA_SOURCE=intervals",
      });
    }
    if (!value.INTERVALS_ATHLETE_ID) {
      context.addIssue({
        code: "custom",
        path: ["INTERVALS_ATHLETE_ID"],
        message: "INTERVALS_ATHLETE_ID is required when DATA_SOURCE=intervals",
      });
    }
  });

export interface WorkerEnv {
  INTERVALS_API_KEY?: string;
  INTERVALS_ATHLETE_ID?: string;
  DEFAULT_TIMEZONE?: string;
  DATA_SOURCE?: string;
  MAX_HISTORY_DAYS?: string;
  NODE_ENV?: string;
  ATHLETE_ID?: string;
  ATHLETE_PROFILE_JSON?: string;
  TRAINING_DB?: D1Database;
}

export type AppConfig = z.infer<typeof envSchema>;

export class ConfigurationError extends Error {
  readonly code = "INVALID_CONFIGURATION";

  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export function parseConfig(env: WorkerEnv): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new ConfigurationError(`Invalid environment configuration: ${details}`);
  }

  try {
    new Intl.DateTimeFormat("en", { timeZone: parsed.data.DEFAULT_TIMEZONE }).format();
  } catch {
    throw new ConfigurationError("Invalid environment configuration: DEFAULT_TIMEZONE is not a valid IANA timezone");
  }

  return parsed.data;
}
