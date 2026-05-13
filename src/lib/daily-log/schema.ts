import { z } from 'zod';

import { DAILY_LOG_LIMITS } from '@/constants/limits';

export const dailyLogFormSchema = z.object({
  activities: z
    .string()
    .min(DAILY_LOG_LIMITS.MIN_ACTIVITIES_LENGTH, `Minimo ${DAILY_LOG_LIMITS.MIN_ACTIVITIES_LENGTH} caracteres`)
    .max(DAILY_LOG_LIMITS.MAX_ACTIVITIES_LENGTH, `Maximo ${DAILY_LOG_LIMITS.MAX_ACTIVITIES_LENGTH} caracteres`),
  crewPresent: z
    .array(z.string())
    .min(1, 'Selecione pelo menos 1 membro da equipe'),
  postsInstalledCount: z
    .number()
    .int()
    .min(0, 'Valor deve ser >= 0')
    .default(0),
  metersBT: z.number().min(0).default(0),
  metersMT: z.number().min(0).default(0),
  metersRede: z.number().min(0).default(0),
  materialsConsumed: z.array(
    z.object({
      materialId: z.string(),
      name: z.string().min(1, 'Nome obrigatorio'),
      unit: z.string().min(1, 'Unidade obrigatoria'),
      quantity: z.number().min(0.01, 'Quantidade deve ser > 0'),
    }),
  ).default([]),
  incidents: z
    .string()
    .max(DAILY_LOG_LIMITS.MAX_INCIDENTS_LENGTH, `Maximo ${DAILY_LOG_LIMITS.MAX_INCIDENTS_LENGTH} caracteres`)
    .optional()
    .default(''),
  rejectionReason: z.string().optional().default(''),
});

export type DailyLogFormData = z.infer<typeof dailyLogFormSchema>;

export function formDataToRpcPayload(
  data: DailyLogFormData,
): {
  crew_present: string[];
  activities: string;
  posts_installed_count: number;
  meters_installed: { BT: number; MT: number; rede: number };
  materials_consumed: Array<{ materialId: string; name: string; unit: string; quantity: number }>;
  incidents: string | null;
  rejection_reason: string | null;
} {
  return {
    crew_present: data.crewPresent,
    activities: data.activities,
    posts_installed_count: data.postsInstalledCount,
    meters_installed: {
      BT: data.metersBT,
      MT: data.metersMT,
      rede: data.metersRede,
    },
    materials_consumed: data.materialsConsumed,
    incidents: data.incidents?.trim() || null,
    rejection_reason: data.rejectionReason?.trim() || null,
  };
}
