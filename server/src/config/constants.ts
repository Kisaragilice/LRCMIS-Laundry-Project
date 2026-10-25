export const AUTH_COOKIE = 'lrcmis_token';
export const CSRF_COOKIE = 'lrcmis_csrf';
export const CSRF_HEADER = 'x-csrf-token';

export const ROLES = {
  CUSTOMER: 'customer',
  ADMIN: 'admin',
  STAFF: 'staff',
  COURIER: 'courier',
  OWNER: 'owner',
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

// Business policy: see README § Business rules.
export const POLICY = {
  minWeightKg: 3,
  weightRoundingKg: 0.5,
  defaultDeliveryFee: 5000,
  reservationCancelCutoffHours: 2,
} as const;
