/**
 * File-based dry-run confirmation service
 */
import type { PendingConfirmation, ConfirmationResult } from "./types.js";
/**
 * Create a new pending confirmation
 */
export declare function createConfirmation(operationType: string, description: string, preview: Record<string, unknown>, payload: Record<string, unknown>): PendingConfirmation;
/**
 * Read a confirmation from file
 */
export declare function getConfirmation(id: string): PendingConfirmation | null;
/**
 * Execute a pending confirmation
 */
export declare function executeConfirmation(id: string, executeAction: (payload: Record<string, unknown>) => Promise<unknown>): Promise<ConfirmationResult>;
/**
 * Cancel a pending confirmation
 */
export declare function cancelConfirmation(id: string): ConfirmationResult;
//# sourceMappingURL=confirmation-service.d.ts.map