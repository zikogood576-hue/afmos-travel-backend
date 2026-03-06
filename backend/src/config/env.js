import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.string().optional(),
  PORT: z.string().optional(),

  JWT_SECRET: z.string().min(20, 'JWT_SECRET doit être plus long (>= 20)'),
  JWT_EXPIRES_IN: z.string().default('12h'),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),

  DATABASE_URL: z.string().min(10),

  OSRM_BASE_URL: z.string().url().default('https://router.project-osrm.org'),

  FRAUD_GPS_CITY_THRESHOLD_KM: z.coerce.number().positive().default(50),
  DISTANCE_REIMBURSEMENT_THRESHOLD_KM: z.coerce.number().nonnegative().default(100),
  DISTANCE_REIMBURSEMENT_AMOUNT_MAD: z.coerce.number().nonnegative().default(40),
  LUNCH_AMOUNT_MAD: z.coerce.number().nonnegative().default(30),
  DINNER_AMOUNT_MAD: z.coerce.number().nonnegative().default(30),
  BOTH_MEALS_AMOUNT_MAD: z.coerce.number().nonnegative().default(60)
});

export const env = schema.parse(process.env);

