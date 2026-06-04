// Members, profiles, invitations, and private contact details (FR-001 to FR-005, FR-019).
import { z } from 'zod';
import { email, memberRef, optionalText, password } from './common.ts';

export const displayName = z
  .string({ message: 'Please add your name.' })
  .trim()
  .min(1, 'Please add your name.')
  .max(60, 'Please keep your name to 60 characters or fewer.');

export const bio = optionalText(500, 'Please keep this to 500 characters or fewer.');

export const AcceptInvitation = z.object({
  email,
  displayName,
  password,
  emailNotifications: z.boolean().default(false)
});
export type AcceptInvitation = z.infer<typeof AcceptInvitation>;

export const ConfirmJoin = z.object({ token: z.string().min(1, 'That link is not valid.') });
export const ResendConfirmation = z.object({ email });

export const InvitationCheck = z.object({ valid: z.literal(true), inviterName: z.string() });

export const CreatedInvitation = z.object({
  id: z.string(),
  link: z.string(),
  expiresAt: z.string()
});

export const InvitationStatus = z.enum(['unused', 'waiting', 'used', 'expired', 'cancelled']);
export const MyInvitation = z.object({
  id: z.string(),
  status: InvitationStatus,
  createdAt: z.string(),
  expiresAt: z.string(),
  usedBy: memberRef.nullable()
});
export type MyInvitation = z.infer<typeof MyInvitation>;

export const MemberProfile = z.object({
  id: z.string(),
  displayName: z.string(),
  bio: z.string().nullable(),
  joinedAt: z.string(),
  isFounder: z.boolean(),
  isFormerMember: z.boolean(),
  invitedBy: memberRef.nullable(),
  invitees: z.array(memberRef)
});
export type MemberProfile = z.infer<typeof MemberProfile>;

export const ChainLink = memberRef.extend({ isFounder: z.boolean() });
export const MemberChain = z.object({ chain: z.array(ChainLink) });
export type MemberChain = z.infer<typeof MemberChain>;

export const Me = z.object({
  id: z.string(),
  displayName: z.string(),
  bio: z.string().nullable(),
  isFounder: z.boolean(),
  joinedAt: z.string()
});
export type Me = z.infer<typeof Me>;

export const UpdateMe = z.object({ displayName: displayName.optional(), bio: bio.optional() });

export const ContactDetails = z.object({
  sharePhone: optionalText(40, 'Please keep the phone number to 40 characters or fewer.'),
  shareEmail: z
    .string()
    .trim()
    .toLowerCase()
    .nullish()
    .transform((value) => (value ? value : null))
    .pipe(z.email({ message: 'Please enter a valid email address, like name@example.org.' }).nullable())
});
export type ContactDetails = z.infer<typeof ContactDetails>;

export const ChangePassword = z.object({
  currentPassword: z.string().min(1, 'Please enter your current password.'),
  newPassword: password
});
