import { z } from 'zod';

export const registerSchema = z.object({
  username: z.string().trim().min(3, "Username must be at least 3 characters long.").max(30, "Username cannot exceed 30 characters."),
  email: z.string().trim().toLowerCase().email("Invalid email address.").max(100, "Email cannot exceed 100 characters."),
  password: z.string().min(6, "Password must be at least 6 characters long.").max(100, "Password is too long (max 100 characters)."),
    confirmPassword: z.string().min(6, "Please confirm your password.")
  }).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});

export const loginSchema = z.object({
  username: z.string().trim().min(1, "Username or Email is required."),
  password: z.string().min(1, "Password is required."),
});