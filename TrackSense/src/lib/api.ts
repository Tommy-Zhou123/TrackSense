import axios from "axios";
import type { StatementParseResponse } from "@/types/csvImport";

const API_URL: string = (import.meta.env.VITE_API_URL as string) || "";

export const api = axios.create({
  baseURL: API_URL,
});

export type StatementParseProgress = {
  type: "progress";
  phase?: string;
  provider?: string;
  model?: string;
  label?: string;
};

type StatementParseEvent =
  | StatementParseProgress
  | (StatementParseResponse & { type: "result" })
  | { type: "error"; status?: number; message?: string };

function parseJsonLine(line: string): StatementParseEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as StatementParseEvent;
  } catch {
    return null;
  }
}

export async function parseStatementStream({
  file,
  token,
  profileId,
  onProgress,
  signal,
}: {
  file: File;
  token?: string | null;
  profileId?: string | null;
  onProgress?: (progress: StatementParseProgress) => void;
  signal?: AbortSignal;
}): Promise<StatementParseResponse> {
  const form = new FormData();
  form.append("file", file);

  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (profileId) headers["X-Profile-Id"] = profileId;

  const response = await fetch(`${API_URL}/api/expenses/parse-statement`, {
    method: "POST",
    headers,
    body: form,
    signal: signal ?? AbortSignal.timeout(120_000),
  });

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("ndjson")) {
    const data = (await response.json().catch(() => ({}))) as {
      message?: string;
    } & Partial<StatementParseResponse>;
    if (!response.ok) {
      const error = new Error(data.message || "Could not parse statement");
      (error as Error & { status?: number }).status = response.status;
      throw error;
    }
    return data as StatementParseResponse;
  }

  if (!response.body) {
    throw new Error("Could not parse statement");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: StatementParseResponse | null = null;
  let streamError: (Error & { status?: number }) | null = null;

  const consume = (line: string) => {
    const event = parseJsonLine(line);
    if (!event) return;
    if (event.type === "progress") {
      onProgress?.(event);
      return;
    }
    if (event.type === "result") {
      result = {
        expenses: event.expenses || [],
        skipped: event.skipped || 0,
        warnings: event.warnings || [],
        hasAccount: Boolean(event.hasAccount),
      };
      return;
    }
    if (event.type === "error") {
      streamError = new Error(event.message || "Could not parse statement");
      streamError.status = event.status || 500;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) consume(line);
    if (done) break;
  }
  if (buffer.trim()) consume(buffer);

  if (streamError) throw streamError;
  if (!result) throw new Error("Could not parse statement");
  return result;
}
