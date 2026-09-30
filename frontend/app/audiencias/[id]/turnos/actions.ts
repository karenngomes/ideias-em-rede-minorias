"use server";

import { getPersuasionAudit } from "@/lib/api-server";

export async function fetchPersuasionAudit(recordId: number, jobId: string, chunkIndexes: number[]) {
  return getPersuasionAudit(recordId, jobId, chunkIndexes.slice(0, 20));
}
