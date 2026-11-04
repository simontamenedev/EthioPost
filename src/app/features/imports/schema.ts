import { z } from "zod";

export const uploadSchema = z.object({
  dataset: z.enum(["transactions", "registrations", "upgrades"], { message: "Choose the report type" }),
  file: z
    .instanceof(File, { message: "Choose a CSV file" })
    .refine((f) => f.name.toLowerCase().endsWith(".csv"), "File must be a .csv")
    .refine((f) => f.size <= 20 * 1024 * 1024, "Max file size is 20 MB"),
});

export type UploadFormValues = z.infer<typeof uploadSchema>;