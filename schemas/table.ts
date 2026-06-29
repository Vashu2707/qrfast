import { z } from "zod";

export const tableSchema = z.object({
  number: z.string().min(1, "Table number/label is required"),
});
