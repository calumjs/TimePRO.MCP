/**
 * File-based dry-run confirmation service
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import type { PendingConfirmation, ConfirmationResult, ConfirmationStatus } from "./types.js";

const DRY_RUN_DIR = join(process.cwd(), "dry-run");
const EXPIRATION_HOURS = 24;

function ensureDir(): void {
  if (!existsSync(DRY_RUN_DIR)) {
    mkdirSync(DRY_RUN_DIR, { recursive: true });
  }
}

function generateId(): string {
  const timestamp = Date.now();
  const hex = randomBytes(4).toString("hex");
  return `${timestamp}-${hex}`;
}

function getFilePath(id: string): string {
  return join(DRY_RUN_DIR, `${id}.json`);
}

/**
 * Create a new pending confirmation
 */
export function createConfirmation(
  operationType: string,
  description: string,
  preview: Record<string, unknown>,
  payload: Record<string, unknown>
): PendingConfirmation {
  ensureDir();

  const id = generateId();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + EXPIRATION_HOURS * 60 * 60 * 1000);

  const confirmation: PendingConfirmation = {
    id,
    operationType,
    status: "Pending",
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    description,
    preview,
    payload,
  };

  writeFileSync(getFilePath(id), JSON.stringify(confirmation, null, 2), "utf-8");
  return confirmation;
}

/**
 * Read a confirmation from file
 */
export function getConfirmation(id: string): PendingConfirmation | null {
  const filePath = getFilePath(id);
  if (!existsSync(filePath)) {
    return null;
  }
  const content = readFileSync(filePath, "utf-8");
  return JSON.parse(content) as PendingConfirmation;
}

function updateConfirmation(confirmation: PendingConfirmation): void {
  writeFileSync(getFilePath(confirmation.id), JSON.stringify(confirmation, null, 2), "utf-8");
}

/**
 * Execute a pending confirmation
 */
export async function executeConfirmation(
  id: string,
  executeAction: (payload: Record<string, unknown>) => Promise<unknown>
): Promise<ConfirmationResult> {
  const confirmation = getConfirmation(id);
  if (!confirmation) {
    return { success: false, message: `Confirmation ${id} not found` };
  }

  if (confirmation.status !== "Pending") {
    return { success: false, message: `Confirmation ${id} is already ${confirmation.status}` };
  }

  // Check expiration
  if (new Date() > new Date(confirmation.expiresAt)) {
    confirmation.status = "Expired";
    updateConfirmation(confirmation);
    return { success: false, message: `Confirmation ${id} has expired` };
  }

  try {
    const data = await executeAction(confirmation.payload);
    confirmation.status = "Confirmed";
    updateConfirmation(confirmation);
    return { success: true, message: `Operation ${confirmation.operationType} executed successfully`, data };
  } catch (error) {
    confirmation.status = "Failed";
    updateConfirmation(confirmation);
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, message: `Operation failed: ${msg}` };
  }
}

/**
 * Cancel a pending confirmation
 */
export function cancelConfirmation(id: string): ConfirmationResult {
  const confirmation = getConfirmation(id);
  if (!confirmation) {
    return { success: false, message: `Confirmation ${id} not found` };
  }

  if (confirmation.status !== "Pending") {
    return { success: false, message: `Confirmation ${id} is already ${confirmation.status}` };
  }

  confirmation.status = "Cancelled";
  updateConfirmation(confirmation);
  return { success: true, message: `Confirmation ${id} cancelled` };
}
