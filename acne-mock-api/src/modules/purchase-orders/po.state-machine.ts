import type { POStatus } from '../../store/types.js';

/**
 * Valid PO status transitions.
 *
 * Normal lifecycle:
 *   DRAFT → PENDING_APPROVAL → APPROVED → SENT_TO_SUPPLIER →
 *   CONFIRMED_BY_SUPPLIER → IN_PRODUCTION → SHIPPED →
 *   PARTIALLY_RECEIVED → RECEIVED → CLOSED
 *
 * CANCELLED is reachable from any state except RECEIVED and CLOSED.
 * REJECTED (goes back to DRAFT) is allowed from PENDING_APPROVAL.
 */
const TRANSITIONS: Record<POStatus, readonly POStatus[]> = {
  DRAFT:                 ['PENDING_APPROVAL', 'CANCELLED'],
  PENDING_APPROVAL:      ['APPROVED', 'DRAFT', 'CANCELLED'],        // DRAFT = rejected
  APPROVED:              ['SENT_TO_SUPPLIER', 'CANCELLED'],
  SENT_TO_SUPPLIER:      ['CONFIRMED_BY_SUPPLIER', 'CANCELLED'],
  CONFIRMED_BY_SUPPLIER: ['IN_PRODUCTION', 'CANCELLED'],
  IN_PRODUCTION:         ['SHIPPED', 'CANCELLED'],
  SHIPPED:               ['PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'],
  PARTIALLY_RECEIVED:    ['RECEIVED', 'CANCELLED'],
  RECEIVED:              ['CLOSED'],
  CLOSED:                [],
  CANCELLED:             [],
};

/**
 * States from which a PO can still be cancelled.
 * Once RECEIVED or CLOSED the PO cannot be cancelled.
 */
const CANCELLABLE: ReadonlySet<POStatus> = new Set<POStatus>([
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'SENT_TO_SUPPLIER',
  'CONFIRMED_BY_SUPPLIER',
  'IN_PRODUCTION',
  'SHIPPED',
  'PARTIALLY_RECEIVED',
]);

/**
 * Pure function: returns `true` when transitioning from `from` to `to` is valid.
 */
export function canTransition(from: POStatus, to: POStatus): boolean {
  const allowed = TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

/**
 * Returns the list of states that `from` can transition to.
 */
export function allowedTransitions(from: POStatus): readonly POStatus[] {
  return TRANSITIONS[from] ?? [];
}

/**
 * Convenience: can this PO still be cancelled?
 */
export function isCancellable(status: POStatus): boolean {
  return CANCELLABLE.has(status);
}
