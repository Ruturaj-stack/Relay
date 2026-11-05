import { z } from 'zod'
import type { ItemCategory, ItemCondition } from '@/types'
import { CATEGORIES, CONDITION_ORDER } from '@/lib/utils'

const conditionEnum = z.enum(CONDITION_ORDER as [ItemCondition, ...ItemCondition[]])
const categoryEnum = z.enum(CATEGORIES as [ItemCategory, ...ItemCategory[]])

export const signInSchema = z.object({
  email: z.string().min(1, 'Enter your email').email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export type SignInValues = z.infer<typeof signInSchema>

export const signUpSchema = z.object({
  name: z.string().min(2, 'Enter your full name').max(60),
  email: z.string().min(1, 'Enter your email').email('Enter a valid email address'),
  password: z.string().min(8, 'Use at least 8 characters'),
  workspaceName: z.string().min(2, 'Name your workspace').max(60),
})

export type SignUpValues = z.infer<typeof signUpSchema>

export const handoffDetailsSchema = z.object({
  description: z
    .string()
    .min(12, 'Add a little context so the receiver knows what this is for')
    .max(600, 'Keep the description under 600 characters'),
  instructions: z.string().max(800, 'Keep instructions under 800 characters').optional().default(''),
  conditionOut: conditionEnum,
  dueAt: z
    .string()
    .min(1, 'Choose a return date')
    .refine((value) => !Number.isNaN(new Date(value).getTime()), 'Choose a valid date')
    .refine((value) => new Date(value).getTime() > Date.now() - 86_400_000, 'The return date must be in the future'),
})

export const newHandoffSchema = z.object({
  itemId: z.string().min(1, 'Choose the item being handed off'),
  senderId: z.string().min(1, 'Choose the sender'),
  receiverId: z.string().min(1, 'Choose a receiver'),
  teamId: z.string().optional(),
  description: z.string().min(12, 'Add a little context for the receiver').max(600),
  instructions: z.string().max(800).optional().default(''),
  conditionOut: conditionEnum,
  dueAt: z.string().min(1, 'Choose a return date'),
  photos: z.array(z.string()).max(6, 'Up to 6 photographs').default([]),
})

export type NewHandoffValues = z.infer<typeof newHandoffSchema>

export const itemSchema = z.object({
  name: z.string().min(2, 'Give the item a name').max(80),
  description: z.string().max(500).optional().default(''),
  category: categoryEnum,
  serial: z.string().max(80).optional().default(''),
  ownerId: z.string().min(1, 'Choose an owner'),
  condition: conditionEnum,
  location: z.string().max(120).optional().default(''),
  value: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => {
      if (value === '' || value === undefined) return undefined
      const parsed = typeof value === 'number' ? value : Number(value)
      return Number.isFinite(parsed) ? parsed : undefined
    }),
  image: z.string().optional().default(''),
  tags: z.array(z.string()).max(8).optional().default([]),
})

export type ItemFormValues = z.infer<typeof itemSchema>

export const profileSchema = z.object({
  name: z.string().min(2, 'Enter your name').max(60),
  email: z.string().email('Enter a valid email address'),
  title: z.string().max(80).optional().default(''),
  phone: z.string().max(30).optional().default(''),
  timezone: z.string().min(1),
  avatar: z.string().optional(),
})

export type ProfileFormValues = z.infer<typeof profileSchema>

export const teamSchema = z.object({
  name: z.string().min(2, 'Give the team a name').max(50),
  description: z.string().max(200, 'Keep it under 200 characters').optional().default(''),
  color: z.string().min(1),
})

export type TeamFormValues = z.infer<typeof teamSchema>

export const inviteSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  role: z.enum(['admin', 'member', 'viewer']),
})

export type InviteValues = z.infer<typeof inviteSchema>

export const confirmReceiptSchema = z.object({
  condition: conditionEnum,
  note: z.string().max(400).optional().default(''),
  photo: z.string().optional(),
})

export type ConfirmReceiptValues = z.infer<typeof confirmReceiptSchema>

export const issueSchema = z.object({
  handoffId: z.string().optional(),
  title: z.string().min(4, 'Add a short summary').max(90),
  detail: z.string().min(10, 'Describe the issue so the team can respond').max(600),
})

export type IssueValues = z.infer<typeof issueSchema>

export const noteSchema = z.object({
  note: z.string().min(2, 'Write a note first').max(500),
})

export const passwordSchema = z
  .object({
    current: z.string().min(6, 'Enter your current password'),
    next: z.string().min(8, 'Use at least 8 characters'),
    confirm: z.string(),
  })
  .refine((values) => values.next === values.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  })

export type PasswordValues = z.infer<typeof passwordSchema>

export const returnSchema = z.object({
  condition: conditionEnum,
  note: z.string().max(400).optional().default(''),
})
