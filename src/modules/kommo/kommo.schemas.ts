import { z } from 'zod';
export const kommoWebhookQuerySchema = z.object({ secret: z.string().optional() });
