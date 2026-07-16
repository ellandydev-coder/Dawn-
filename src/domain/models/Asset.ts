// src/domain/models/Asset.ts

import { z } from 'zod';

/** Metadata serializable de un asset de audio. */
export const AssetSchema = z.object({
  id: z.string(),
  name: z.string(),
  duration: z.number(),        // segundos
  sampleRate: z.number(),
  numberOfChannels: z.number(),
  sizeBytes: z.number().optional(),
  /**
   * Origen del asset:
   * - 'file'      → importado desde disco
   * - 'url'       → cargado desde URL remota
   * - 'recording' → grabado desde entrada de audio (mic/línea)
   */
  source: z.enum(['file', 'url', 'recording']),
  originalUrl: z.string().optional(),
  createdAt: z.number(),
});

export type Asset = z.infer<typeof AssetSchema>;