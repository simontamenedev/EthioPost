import { z } from "zod";

export const uploadSchema = z.object({
  fsp_id: z.string().uuid("Choose a service provider"),
  dataset: z.enum(["transactions", "registrations", "upgrades"]),
  file: z.instanceof(File).refine((f) => f.size <= 20 * 1024 * 1024, "File is larger than 20 MB"),
});

export type UploadFormValues = z.infer<typeof uploadSchema>;