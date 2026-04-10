import type { SOStatus } from '../../store/types.js';

// ─── FORWARD LIFECYCLE ─────────────────────────────────
// DRAFT -> CONFIRMED -> ALLOCATED -> PICKING -> PACKED -> SHIPPED -> DELIVERED
// PARTIALLY_SHIPPED is valid from PICKING or PACKED.
// Any pre-SHIPPED state -> CANCELLED
// Any post-SHIPPED state -> RETURNED
// Any state -> ON_HOLD  and  ON_HOLD -> (previous state via release)

const forwardTransitions: Record<SOStatus, SOStatus[]> = {
  DRAFT:             ['CONFIRMED', 'CANCELLED', 'ON_HOLD'],
  CONFIRMED:         ['ALLOCATED', 'CANCELLED', 'ON_HOLD'],
  ALLOCATED:         ['PICKING', 'CANCELLED', 'ON_HOLD'],
  PICKING:           ['PACKED', 'PARTIALLY_SHIPPED', 'CANCELLED', 'ON_HOLD'],
  PACKED:            ['SHIPPED', 'PARTIALLY_SHIPPED', 'CANCELLED', 'ON_HOLD'],
  PARTIALLY_SHIPPED: ['SHIPPED', 'ON_HOLD'],
  SHIPPED:           ['DELIVERED', 'RETURNED', 'ON_HOLD'],
  DELIVERED:         ['RETURNED', 'ON_HOLD'],
  RETURNED:          ['ON_HOLD'],
  CANCELLED:         ['ON_HOLD'],
  ON_HOLD:           [], // release is handled separately — any previous state is valid
};

/**
 * Determines whether a status transition is allowed.
 *
 * ON_HOLD release logic: `canTransition('ON_HOLD', previousStatus)` returns
 * true for any status that was the state before being put on hold.  The caller
 * is responsible for passing the correct `previousStatus` value stored on the
 * order when it was placed on hold.
 */
export function canTransition(
  from: SOStatus,
  to: SOStatus,
  previousStatus?: SOStatus | null,
): boolean {
  // Release from ON_HOLD — allowed back to whatever the previous status was
  if (from === 'ON_HOLD' && previousStatus && to === previousStatus) {
    return true;
  }

  const allowed = forwardTransitions[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

/**
 * Returns the list of statuses reachable from the given status.
 */
export function allowedTransitions(
  from: SOStatus,
  previousStatus?: SOStatus | null,
): SOStatus[] {
  const allowed = [...(forwardTransitions[from] ?? [])];

  // When ON_HOLD and we know the previous status, add it as a valid target
  if (from === 'ON_HOLD' && previousStatus) {
    if (!allowed.includes(previousStatus)) {
      allowed.push(previousStatus);
    }
  }

  return allowed;
}
