/**
 * Job Cancellation Registry — in-memory signal store.
 *
 * When a user cancels a job via the API, the jobId is added here.
 * The job processor and renderer check this registry at every pipeline checkpoint.
 * If a job is cancelled, the processor throws immediately and any child processes
 * (Remotion/FFmpeg exec) are killed via the stored ChildProcess reference.
 */

import type { ChildProcess } from "child_process";

// Set of cancelled job IDs (in-memory — resets on process restart, which is fine)
const cancelledJobs = new Set<string>();

// Map of jobId → active child process (Remotion exec, FFmpeg, etc.)
const activeChildProcesses = new Map<string, ChildProcess>();

/**
 * Mark a job as cancelled. If there's an active child process, kill it.
 */
export function cancelJob(jobId: string): void {
  cancelledJobs.add(jobId);

  // Kill active child process if exists
  const child = activeChildProcesses.get(jobId);
  if (child && !child.killed) {
    console.log(`[CancelRegistry] Killing child process for job ${jobId.slice(0, 8)} (PID: ${child.pid})`);
    child.kill("SIGKILL");
    activeChildProcesses.delete(jobId);
  }
}

/**
 * Check if a job has been cancelled. Throws if yes.
 * Call this at every pipeline checkpoint.
 */
export function assertNotCancelled(jobId: string): void {
  if (cancelledJobs.has(jobId)) {
    throw new Error("⛔ Job đã bị hủy bởi người dùng");
  }
}

/**
 * Check cancellation status without throwing.
 */
export function isCancelled(jobId: string): boolean {
  return cancelledJobs.has(jobId);
}

/**
 * Register a child process for a job so it can be killed on cancellation.
 */
export function registerChildProcess(jobId: string, child: ChildProcess): void {
  activeChildProcesses.set(jobId, child);
}

/**
 * Unregister a child process (call when process exits normally).
 */
export function unregisterChildProcess(jobId: string): void {
  activeChildProcesses.delete(jobId);
}

/**
 * Cleanup: remove job from all registries (call after job completes/fails).
 */
export function cleanupJob(jobId: string): void {
  cancelledJobs.delete(jobId);
  activeChildProcesses.delete(jobId);
}
