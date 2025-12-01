/**
 * BookingDetailsDialog - Modularized Component
 *
 * This file re-exports from the modular implementation for backward compatibility.
 * The implementation has been refactored following SOLID principles:
 *
 * - SRP: Each module has a single responsibility
 * - OCP: New tabs/dialogs can be added via composition
 * - DIP: Components depend on abstractions (interfaces)
 * - ISP: Props are scoped per component needs
 *
 * @see ./booking-details/index.ts for the full module structure
 */

// Main component export
export { BookingDetailsDialog } from './booking-details';

// Type exports for consumers
export type { BookingDetailsDialogProps, BookingDetailsTab } from './booking-details';
