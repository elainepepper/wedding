export type RsvpStatus = "Pending" | "Confirmed" | "Declined";
export function canonicalRsvpStatus(value: unknown): RsvpStatus;
export function isChildAgeGroup(value: unknown): boolean;
export function canonicalAgeGroup(value: unknown): "Adult" | "Child";
export function isEnabledFlag(value: unknown): boolean;
export function isValidInternationalMobile(value: unknown): boolean;
