export type MissionStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED" | "FAILED";
export type TaskStatus = "LOCKED" | "OPEN" | "ASSIGNED" | "REVISION_REQUESTED" | "ACCEPTED" | "REOPENED" | "CANCELLED";

export interface Mission {
  id: number;
  creator: string;
  goal: string;
  constraints: string;
  deadline: number;
  budget: number;
  spent: number;
  reserved: number;
  creator_refund_credit: number;
  status: MissionStatus;
  title: string;
  summary: string;
  assumptions: string[];
  risk_codes: string[];
  replan_rounds: number;
}

export interface Task {
  id: number;
  mission_id: number;
  local_index: number;
  title: string;
  objective: string;
  skills: string[];
  deliverable_type: string;
  acceptance_criteria: string[];
  dependency_task_ids: number[];
  budget_cap: number;
  duration_hours: number;
  is_final_integration: boolean;
  status: TaskStatus;
  assigned_agent: string;
  agreed_payment: number;
  revision_rounds: number;
  due_time: number;
  revision_feedback: string;
  accepted_summary: string;
  accepted_artifact_urls: string[];
}

export interface ProtocolConfig {
  owner: string;
  minimum_mission_budget: number;
  protocol_fee_bps: number;
  maximum_protocol_fee_bps: number;
  next_mission_id: number;
  next_task_id: number;
  protocol_fees: number;
}

export function parseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function toUnixSeconds(dateValue: string): bigint {
  const time = new Date(dateValue).getTime();
  if (!Number.isFinite(time)) return 0n;
  return BigInt(Math.floor(time / 1000));
}

export function formatWei(value: number | bigint | undefined): string {
  const raw = typeof value === "bigint" ? value : BigInt(Math.max(0, Math.floor(value ?? 0)));
  return raw.toLocaleString("en-US");
}

export function taskStatusTone(status: TaskStatus): string {
  if (status === "OPEN" || status === "REOPENED") return "ready";
  if (status === "ASSIGNED" || status === "REVISION_REQUESTED") return "active";
  if (status === "ACCEPTED") return "done";
  if (status === "CANCELLED") return "muted";
  return "locked";
}
