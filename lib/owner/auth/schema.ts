import { z } from "zod";

import { profilePhoneSchema } from "@/lib/profile/schema";

export const ownerSignUpSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(80, "Name must be 80 characters or fewer"),
  email: z.string().trim().email("Enter a valid email address"),
  phone: z.string().optional(),
});

export type OwnerSignUpValues = z.infer<typeof ownerSignUpSchema>;
