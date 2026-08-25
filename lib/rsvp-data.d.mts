export type RsvpStatus = "Pending" | "Confirmed" | "Declined";
export function canonicalRsvpStatus(value: unknown): RsvpStatus;
export function isChildAgeGroup(value: unknown): boolean;
export function canonicalAgeGroup(value: unknown): "Adult" | "Child";
export function isEnabledFlag(value: unknown): boolean;
export function isValidInternationalMobile(value: unknown): boolean;
export function optionalInteger(value: unknown): number | null;
export type InvitationGuestName = {
  id?: unknown;
  first_name?: unknown;
  last_name?: unknown;
  preferred_name?: unknown;
};
export function compareInvitationGuests(a: InvitationGuestName, b: InvitationGuestName): number;
