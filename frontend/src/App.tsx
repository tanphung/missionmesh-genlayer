import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Braces,
  Bug,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  Download,
  ExternalLink,
  GitBranch,
  Loader2,
  Network,
  RefreshCw,
  Send,
  ShieldCheck,
  UserRound,
  Wand2,
  Wallet,
} from "lucide-react";
import {
  Address,
  TxHash,
  connectWallet,
  debugTrace,
  executionSucceeded,
  explorerTxUrl,
  getAccounts,
  isOnGenLayerNetwork,
  isWalletInstalled,
  readContract,
  subscribeToWalletDiscovery,
  waitForFinalized,
  writeContract,
} from "./lib/genlayer";
import {
  Mission,
  ProtocolConfig,
  Task,
  formatWei,
  parseJson,
  taskStatusTone,
  toUnixSeconds,
} from "./lib/mission";

type NoticeTone = "info" | "success" | "error";

interface Notice {
  tone: NoticeTone;
  text: string;
}

interface TxEntry {
  hash: TxHash;
  label: string;
  status: "submitted" | "finalized" | "failed";
  ok?: boolean;
  detail?: string;
}

interface AgentReputation {
  tasks_claimed: number;
  tasks_accepted: number;
  revision_rounds: number;
  tasks_reopened: number;
  tasks_timed_out: number;
  missions_completed: number;
  total_earned: number;
}

interface TaskContext {
  dependency_summaries?: Array<{ task_id: number; title: string; accepted_summary: string }>;
  dependency_artifacts?: Array<{ task_id: number; url: string }>;
  current_revision_feedback?: string;
}

const emptyMission: Mission = {
  id: 0,
  creator: "",
  goal: "",
  constraints: "",
  deadline: 0,
  budget: 0,
  spent: 0,
  reserved: 0,
  creator_refund_credit: 0,
  status: "ACTIVE",
  title: "",
  summary: "",
  assumptions: [],
  risk_codes: [],
  replan_rounds: 0,
};

const emptyTask: Task = {
  id: 0,
  mission_id: 0,
  local_index: 0,
  title: "",
  objective: "",
  skills: [],
  deliverable_type: "",
  acceptance_criteria: [],
  dependency_task_ids: [],
  budget_cap: 0,
  duration_hours: 0,
  is_final_integration: false,
  status: "LOCKED",
  assigned_agent: "",
  agreed_payment: 0,
  revision_rounds: 0,
  due_time: 0,
  revision_feedback: "",
  accepted_summary: "",
  accepted_artifact_urls: [],
};

const demoMissionGoal =
  "Launch a public beta for AtlasOps, an AI-assisted operations dashboard for small logistics teams. The mission should produce market research, product positioning, a clickable UX prototype, a working responsive landing page, QA evidence, deployment notes, and a concise launch checklist for the founding team.";

const demoMissionConstraints =
  "Use English for all customer-facing copy. Keep the first release focused on shipment delay alerts, team handoff notes, and daily operations summaries. Deliver every artifact as a public URL. Do not include private credentials, paid API keys, or customer data. The final integration task must verify desktop and mobile readiness, link the source repository, link the live deployment, and summarize remaining risks.";

function demoDeadlineValue(): string {
  const date = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 16);
}

const DEPLOYED_MISSION_MESH_ADDRESS = "0x144949Aa034c5f20f25Be57f7b5f2cc4964c5501" as Address;
const initialContractAddress = (import.meta.env.VITE_MISSION_MESH_ADDRESS || DEPLOYED_MISSION_MESH_ADDRESS) as Address;

function asAddress(raw: string): Address {
  return raw.trim() as Address;
}

function shortAddress(value: string): string {
  if (!value) return "Not connected";
  if (value.length <= 14) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function deadlineLabel(seconds: number): string {
  if (!seconds) return "Not set";
  return new Date(seconds * 1000).toLocaleString();
}

function safeJson(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function receiptDetail(receipt: unknown): string {
  const raw = receipt as Record<string, unknown>;
  const result = raw?.txExecutionResultName ?? raw?.executionResult ?? raw?.status ?? "unknown";
  return `Result: ${String(result)}`;
}

function getReceiptReturn(receipt: unknown): unknown {
  const raw = receipt as Record<string, unknown>;
  const candidates = [
    raw?.result,
    raw?.returnValue,
    raw?.return_value,
    raw?.data,
    raw?.transaction?.["result" as keyof object],
  ];
  for (const candidate of candidates) {
    if (candidate !== undefined && candidate !== null) return candidate;
  }
  return undefined;
}

export default function App() {
  const [contractAddress, setContractAddress] = useState<string>(() => {
    return window.localStorage.getItem("missionmesh.address") || initialContractAddress || "";
  });
  const [account, setAccount] = useState<Address | "">("");
  const [walletInstalled, setWalletInstalled] = useState(() => isWalletInstalled());
  const [walletNetworkOk, setWalletNetworkOk] = useState(false);
  const [notice, setNotice] = useState<Notice>({ tone: "info", text: "Configure a Studio contract address, then load protocol state." });
  const [busy, setBusy] = useState<string>("");
  const [protocol, setProtocol] = useState<ProtocolConfig | null>(null);
  const [mission, setMission] = useState<Mission | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<number>(0);
  const [taskContext, setTaskContext] = useState<TaskContext | null>(null);
  const [agentBalance, setAgentBalance] = useState<bigint>(0n);
  const [creatorCredit, setCreatorCredit] = useState<bigint>(0n);
  const [reputation, setReputation] = useState<AgentReputation | null>(null);
  const [txs, setTxs] = useState<TxEntry[]>([]);
  const [trace, setTrace] = useState("");

  const [goal, setGoal] = useState("");
  const [constraints, setConstraints] = useState("");
  const [deadline, setDeadline] = useState("");
  const [budgetWei, setBudgetWei] = useState("");
  const [missionIdInput, setMissionIdInput] = useState("1");

  const [proposal, setProposal] = useState("I will complete this task using public artifacts, clear handoff notes, and evidence URLs that map to each acceptance criterion.");
  const [profileSummary, setProfileSummary] = useState("Mission operator with product, frontend, and launch workflow experience.");
  const [portfolioUrls, setPortfolioUrls] = useState("[\"https://example.com/portfolio\"]");
  const [requestedPayment, setRequestedPayment] = useState("100000000000000000");
  const [deliverableSummary, setDeliverableSummary] = useState("Completed the task and mapped the evidence to every acceptance criterion.");
  const [artifactUrls, setArtifactUrls] = useState("[\"https://example.com/demo-artifact\"]");
  const [replanReason, setReplanReason] = useState("blocked by timeout and dependency risk; create a replacement plan for unfinished work");
  const [withdrawAmount, setWithdrawAmount] = useState("0");

  const address = useMemo(() => contractAddress.trim(), [contractAddress]);
  const contractReady = address.startsWith("0x") && address.length >= 10;
  const selectedTask = useMemo(() => tasks.find((task) => task.id === selectedTaskId) ?? tasks[0] ?? emptyTask, [selectedTaskId, tasks]);
  const openTasks = useMemo(() => tasks.filter((task) => task.status === "OPEN" || task.status === "REOPENED"), [tasks]);

  const showNotice = useCallback((tone: NoticeTone, text: string) => {
    setNotice({ tone, text });
  }, []);

  const addTx = useCallback((entry: TxEntry) => {
    setTxs((current) => [entry, ...current].slice(0, 8));
  }, []);

  const updateTx = useCallback((hash: TxHash, patch: Partial<TxEntry>) => {
    setTxs((current) => current.map((entry) => (entry.hash === hash ? { ...entry, ...patch } : entry)));
  }, []);

  const requireAddress = useCallback((): Address => {
    if (!contractReady) {
      throw new Error("Set a deployed MissionMesh contract address first.");
    }
    return asAddress(address);
  }, [address, contractReady]);

  const loadProtocol = useCallback(async () => {
    const target = requireAddress();
    setBusy("protocol");
    try {
      const raw = await readContract<string>(target, "get_protocol_config");
      const config = parseJson<ProtocolConfig>(raw, {
        owner: "",
        minimum_mission_budget: 0,
        protocol_fee_bps: 0,
        maximum_protocol_fee_bps: 500,
        next_mission_id: 1,
        next_task_id: 1,
        protocol_fees: 0,
      });
      setProtocol(config);
      showNotice("success", "Protocol configuration loaded from Studionet.");
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "Could not load protocol config.");
    } finally {
      setBusy("");
    }
  }, [requireAddress, showNotice]);

  const loadMission = useCallback(
    async (missionIdRaw?: string) => {
      const target = requireAddress();
      const missionId = Number(missionIdRaw ?? missionIdInput);
      if (!Number.isFinite(missionId) || missionId <= 0) {
        showNotice("error", "Enter a valid mission ID.");
        return;
      }
      setBusy("mission");
      try {
        const [missionRaw, idsRaw] = await Promise.all([
          readContract<string>(target, "get_mission", [BigInt(missionId)]),
          readContract<string>(target, "get_mission_task_ids", [BigInt(missionId)]),
        ]);
        const missionData = parseJson<Mission>(missionRaw, { ...emptyMission, id: missionId });
        const taskIds = parseJson<number[]>(idsRaw, []);
        const loadedTasks = await Promise.all(
          taskIds.map(async (taskId) => {
            const raw = await readContract<string>(target, "get_task", [BigInt(taskId)]);
            return parseJson<Task>(raw, { ...emptyTask, id: taskId, mission_id: missionId });
          })
        );
        setMission(missionData);
        setTasks(loadedTasks);
        setSelectedTaskId((current) => (loadedTasks.some((task) => task.id === current) ? current : loadedTasks[0]?.id ?? 0));
        setMissionIdInput(String(missionId));
        showNotice("success", `Mission ${missionId} loaded with ${loadedTasks.length} tasks.`);
      } catch (error) {
        showNotice("error", error instanceof Error ? error.message : "Could not load mission.");
      } finally {
        setBusy("");
      }
    },
    [missionIdInput, requireAddress, showNotice]
  );

  const loadTaskContext = useCallback(
    async (taskId: number) => {
      if (!taskId) return;
      const target = requireAddress();
      setBusy("context");
      try {
        const raw = await readContract<string>(target, "get_task_context", [BigInt(taskId)]);
        setTaskContext(parseJson<TaskContext>(raw, {}));
      } catch (error) {
        showNotice("error", error instanceof Error ? error.message : "Could not load task context.");
      } finally {
        setBusy("");
      }
    },
    [requireAddress, showNotice]
  );

  const loadBalances = useCallback(async () => {
    if (!account) {
      showNotice("error", "Connect a wallet first.");
      return;
    }
    const target = requireAddress();
    setBusy("balances");
    try {
      const [balance, credit, repRaw] = await Promise.all([
        readContract<bigint>(target, "get_balance", [account]),
        readContract<bigint>(target, "get_creator_credit", [account]),
        readContract<string>(target, "get_agent_reputation", [account]),
      ]);
      setAgentBalance(BigInt(balance));
      setCreatorCredit(BigInt(credit));
      setReputation(
        parseJson<AgentReputation>(repRaw, {
          tasks_claimed: 0,
          tasks_accepted: 0,
          revision_rounds: 0,
          tasks_reopened: 0,
          tasks_timed_out: 0,
          missions_completed: 0,
          total_earned: 0,
        })
      );
      showNotice("success", "Balances and reputation loaded.");
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "Could not load balances.");
    } finally {
      setBusy("");
    }
  }, [account, requireAddress, showNotice]);

  const connect = async () => {
    setBusy("connect");
    try {
      const connected = await connectWallet();
      setAccount(connected);
      setWalletInstalled(true);
      setWalletNetworkOk(await isOnGenLayerNetwork());
      showNotice("success", `Connected ${shortAddress(connected)}.`);
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "Could not connect wallet.");
    } finally {
      setBusy("");
    }
  };

  const saveAddress = () => {
    window.localStorage.setItem("missionmesh.address", contractAddress.trim());
    showNotice("success", "Contract address saved locally.");
  };

  const fillDemoMission = () => {
    setGoal(demoMissionGoal);
    setConstraints(demoMissionConstraints);
    setDeadline(demoDeadlineValue());
    setBudgetWei("1000000000000000000");
    showNotice("success", "Demo mission details filled.");
  };

  const runTx = async (label: string, functionName: string, args: unknown[], value = 0n, after?: (receipt: unknown) => Promise<void> | void) => {
    if (!account) {
      showNotice("error", "Connect a wallet before sending a transaction.");
      return;
    }
    const target = requireAddress();
    setBusy(functionName);
    try {
      const hash = await writeContract(account, target, functionName, args, value);
      addTx({ hash, label, status: "submitted" });
      showNotice("info", `${label} submitted. Waiting for FINALIZED.`);
      const receipt = await waitForFinalized(hash);
      const ok = executionSucceeded(receipt);
      updateTx(hash, {
        status: ok ? "finalized" : "failed",
        ok,
        detail: receiptDetail(receipt),
      });
      if (!ok) {
        showNotice("error", `${label} finalized without a success result. Inspect the trace.`);
        return;
      }
      await after?.(receipt);
      showNotice("success", `${label} finalized successfully.`);
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : `${label} failed.`);
    } finally {
      setBusy("");
    }
  };

  const createMission = async () => {
    if (!goal.trim()) {
      showNotice("error", "Enter a mission goal or use Fill demo.");
      return;
    }
    if (!constraints.trim()) {
      showNotice("error", "Enter constraints and resource links or use Fill demo.");
      return;
    }
    const deadlineSeconds = toUnixSeconds(deadline);
    if (deadlineSeconds <= 0n) {
      showNotice("error", "Choose a valid mission deadline or use Fill demo.");
      return;
    }
    let budget = 0n;
    try {
      budget = BigInt(budgetWei || "0");
    } catch {
      showNotice("error", "Enter a valid numeric mission budget in wei or use Fill demo.");
      return;
    }
    if (budget <= 0n) {
      showNotice("error", "Enter a mission budget in wei or use Fill demo.");
      return;
    }
    await runTx("Create mission", "create_mission", [goal, constraints, deadlineSeconds], budget, async (receipt) => {
      const returned = getReceiptReturn(receipt);
      const nextIdFallback = protocol?.next_mission_id ?? Number(missionIdInput || "1");
      const missionId = Number(typeof returned === "bigint" ? returned : String(returned ?? nextIdFallback));
      const safeMissionId = Number.isFinite(missionId) && missionId > 0 ? missionId : nextIdFallback;
      await loadMission(String(safeMissionId));
      await loadProtocol();
    });
  };

  const claimTask = async () => {
    if (!selectedTask.id) {
      showNotice("error", "Select a task first.");
      return;
    }
    await runTx("Claim task", "claim_task", [
      BigInt(selectedTask.id),
      proposal,
      profileSummary,
      portfolioUrls,
      BigInt(requestedPayment || "0"),
    ], 0n, async () => {
      await loadMission(String(selectedTask.mission_id || mission?.id || missionIdInput));
      await loadBalances();
    });
  };

  const submitWork = async () => {
    if (!selectedTask.id) {
      showNotice("error", "Select a task first.");
      return;
    }
    await runTx("Submit work", "submit_work", [BigInt(selectedTask.id), deliverableSummary, artifactUrls], 0n, async () => {
      await loadMission(String(selectedTask.mission_id || mission?.id || missionIdInput));
      await loadBalances();
    });
  };

  const maintenanceTx = async (label: string, functionName: string, args: unknown[]) => {
    await runTx(label, functionName, args, 0n, async () => {
      await loadMission(String(mission?.id || missionIdInput));
      await loadBalances();
    });
  };

  const withdraw = async (kind: "agent" | "creator") => {
    const functionName = kind === "agent" ? "withdraw_earnings" : "withdraw_creator_credit";
    await runTx(kind === "agent" ? "Withdraw earnings" : "Withdraw creator credit", functionName, [BigInt(withdrawAmount || "0")], 0n, loadBalances);
  };

  const inspectTrace = async (hash: TxHash) => {
    setBusy(`trace-${hash}`);
    try {
      const result = await debugTrace(hash);
      setTrace(safeJson(result));
      showNotice("success", "Debug trace loaded.");
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "Could not load debug trace.");
    } finally {
      setBusy("");
    }
  };

  useEffect(() => {
    if (selectedTaskId && contractReady) {
      void loadTaskContext(selectedTaskId);
    }
  }, [contractReady, loadTaskContext, selectedTaskId]);

  useEffect(() => {
    let cancelled = false;
    const syncWallet = async () => {
      const installed = isWalletInstalled();
      const accounts = await getAccounts();
      const networkOk = await isOnGenLayerNetwork();
      if (cancelled) return;
      setWalletInstalled(installed);
      setWalletNetworkOk(networkOk);
      if (accounts[0]) {
        setAccount(accounts[0]);
      }
    };
    void syncWallet();
    const unsubscribeDiscovery = subscribeToWalletDiscovery(() => {
      setWalletInstalled(isWalletInstalled());
    });
    const handleAccountsChanged = (accounts: unknown) => {
      const next = Array.isArray(accounts) ? (accounts[0] as Address | undefined) : undefined;
      setAccount(next ?? "");
      if (next) {
        showNotice("success", `Connected ${shortAddress(next)}.`);
      }
    };
    const handleChainChanged = async () => {
      setWalletNetworkOk(await isOnGenLayerNetwork());
    };
    const provider = window.ethereum;
    provider?.on?.("accountsChanged", handleAccountsChanged);
    provider?.on?.("chainChanged", handleChainChanged);
    return () => {
      cancelled = true;
      unsubscribeDiscovery();
      provider?.removeListener?.("accountsChanged", handleAccountsChanged);
      provider?.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [showNotice]);

  return (
    <main className="shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">MissionMesh</p>
          <h1>Turn Goals into Coordinated Work</h1>
        </div>
        <div className="topbarActions">
          <button className="ghostButton" onClick={loadProtocol} disabled={!contractReady || busy !== ""} title="Load protocol configuration">
            {busy === "protocol" ? <Loader2 className="spin" /> : <RefreshCw />}
            Load
          </button>
          <button className="primaryButton" onClick={connect} disabled={busy !== ""} title="Connect wallet">
            <Wallet />
            {account ? shortAddress(account) : walletInstalled ? "Connect" : "Install wallet"}
          </button>
        </div>
      </section>

      <section className={`notice ${notice.tone}`}>
        {notice.tone === "error" ? <AlertTriangle /> : notice.tone === "success" ? <CheckCircle2 /> : <ShieldCheck />}
        <span>{notice.text}</span>
      </section>

      <section className="controlStrip">
        <label>
          <span>MissionMesh contract</span>
          <input value={contractAddress} onChange={(event) => setContractAddress(event.target.value)} placeholder="0x..." />
        </label>
        <button className="iconButton" onClick={saveAddress} title="Save address">
          <Download />
        </button>
        <label>
          <span>Mission ID</span>
          <input value={missionIdInput} onChange={(event) => setMissionIdInput(event.target.value)} inputMode="numeric" />
        </label>
        <button className="secondaryButton" onClick={() => loadMission()} disabled={!contractReady || busy !== ""}>
          <ClipboardList />
          Load mission
        </button>
      </section>

      <section className="metricGrid">
        <Metric icon={<Network />} label="Network" value={import.meta.env.VITE_GENLAYER_NETWORK || "studionet"} />
        <Metric icon={<Wallet />} label="Wallet" value={account ? (walletNetworkOk ? "Connected" : "Wrong network") : walletInstalled ? "Ready" : "Not found"} />
        <Metric icon={<ShieldCheck />} label="Protocol fee" value={protocol ? `${protocol.protocol_fee_bps} bps` : "Not loaded"} />
        <Metric icon={<CircleDollarSign />} label="Minimum budget" value={protocol ? formatWei(protocol.minimum_mission_budget) : "Not loaded"} />
        <Metric icon={<GitBranch />} label="Next IDs" value={protocol ? `M${protocol.next_mission_id} / T${protocol.next_task_id}` : "Not loaded"} />
      </section>

      <section className="workspace">
        <div className="panel creatorPanel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Creator</p>
              <h2>Create a funded mission</h2>
            </div>
            <button className="iconButton" onClick={fillDemoMission} disabled={busy !== ""} title="Fill demo mission">
              <Wand2 />
            </button>
          </div>
          <label>
            <span>Mission goal</span>
            <textarea value={goal} onChange={(event) => setGoal(event.target.value)} rows={5} placeholder="Describe the outcome the mission should coordinate." />
          </label>
          <label>
            <span>Constraints and resource links</span>
            <textarea value={constraints} onChange={(event) => setConstraints(event.target.value)} rows={4} placeholder="Add requirements, links, risks, and delivery rules." />
          </label>
          <div className="twoCol">
            <label>
              <span>Deadline</span>
              <input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
            </label>
            <label>
              <span>Budget wei</span>
              <input value={budgetWei} onChange={(event) => setBudgetWei(event.target.value)} inputMode="numeric" placeholder="1000000000000000000" />
            </label>
          </div>
          <button className="secondaryButton wide" onClick={fillDemoMission} disabled={busy !== ""}>
            <Wand2 />
            Fill demo
          </button>
          <button className="primaryButton wide" onClick={createMission} disabled={!contractReady || !account || busy !== ""}>
            {busy === "create_mission" ? <Loader2 className="spin" /> : <Send />}
            Create mission
          </button>
        </div>

        <div className="panel missionPanel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Mission</p>
              <h2>{mission?.title || "No mission loaded"}</h2>
            </div>
            <StatusPill label={mission?.status || "WAITING"} tone={mission?.status === "COMPLETED" ? "done" : mission?.status === "PAUSED" ? "active" : "ready"} />
          </div>
          <p className="summary">{mission?.summary || "Load a deployed mission to inspect the generated task graph and current state."}</p>
          <div className="missionFacts">
            <span>Budget {formatWei(mission?.budget)}</span>
            <span>Spent {formatWei(mission?.spent)}</span>
            <span>Reserved {formatWei(mission?.reserved)}</span>
            <span>Deadline {deadlineLabel(mission?.deadline ?? 0)}</span>
          </div>
          <div className="taskGraph">
            {tasks.length === 0 ? (
              <div className="emptyState">No tasks loaded yet.</div>
            ) : (
              tasks.map((task, index) => (
                <button
                  key={task.id}
                  className={`taskNode ${selectedTask.id === task.id ? "selected" : ""}`}
                  onClick={() => setSelectedTaskId(task.id)}
                  title={`Open task ${task.id}`}
                >
                  <span className="nodeIndex">{index + 1}</span>
                  <span className="nodeBody">
                    <strong>{task.title}</strong>
                    <small>{task.dependency_task_ids.length ? `Deps ${task.dependency_task_ids.join(", ")}` : "No dependencies"}</small>
                  </span>
                  <StatusPill label={task.status} tone={taskStatusTone(task.status)} />
                  {index < tasks.length - 1 && <ArrowRight className="nodeArrow" />}
                </button>
              ))
            )}
          </div>
          <div className="buttonRow">
            <button className="secondaryButton" onClick={() => maintenanceTx("Refresh availability", "refresh_task_availability", [BigInt(mission?.id || missionIdInput || "0")])} disabled={!mission || busy !== ""}>
              <RefreshCw />
              Refresh
            </button>
            <button className="secondaryButton" onClick={() => maintenanceTx("Finalize mission", "finalize_mission", [BigInt(mission?.id || missionIdInput || "0")])} disabled={!mission || busy !== ""}>
              <BadgeCheck />
              Finalize
            </button>
          </div>
        </div>
      </section>

      <section className="workspace lower">
        <div className="panel taskPanel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Task #{selectedTask.id || "-"}</p>
              <h2>{selectedTask.title || "Select a task"}</h2>
            </div>
            <StatusPill label={selectedTask.status || "NONE"} tone={taskStatusTone(selectedTask.status)} />
          </div>
          <p className="summary">{selectedTask.objective || "Task details appear after loading a mission."}</p>
          <div className="tags">
            {selectedTask.skills.map((skill) => (
              <span key={skill}>{skill}</span>
            ))}
            {selectedTask.is_final_integration && <span>final integration</span>}
          </div>
          <div className="criteria">
            {selectedTask.acceptance_criteria.map((criterion) => (
              <div key={criterion}>
                <CheckCircle2 />
                <span>{criterion}</span>
              </div>
            ))}
          </div>
          <div className="missionFacts">
            <span>Cap {formatWei(selectedTask.budget_cap)}</span>
            <span>Agreed {formatWei(selectedTask.agreed_payment)}</span>
            <span>Due {deadlineLabel(selectedTask.due_time)}</span>
            <span>Revisions {selectedTask.revision_rounds}</span>
          </div>
          {taskContext?.current_revision_feedback && <div className="feedback">{taskContext.current_revision_feedback}</div>}
          {!!taskContext?.dependency_summaries?.length && (
            <div className="handoff">
              <h3>Dependency handoff</h3>
              {taskContext.dependency_summaries.map((item) => (
                <p key={`${item.task_id}-${item.title}`}>
                  <strong>Task {item.task_id}:</strong> {item.accepted_summary}
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="panel agentPanel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Agent</p>
              <h2>Claim and submit work</h2>
            </div>
            <UserRound />
          </div>
          <label>
            <span>Proposal</span>
            <textarea value={proposal} onChange={(event) => setProposal(event.target.value)} rows={3} />
          </label>
          <label>
            <span>Profile summary</span>
            <textarea value={profileSummary} onChange={(event) => setProfileSummary(event.target.value)} rows={3} />
          </label>
          <div className="twoCol">
            <label>
              <span>Portfolio URLs JSON</span>
              <input value={portfolioUrls} onChange={(event) => setPortfolioUrls(event.target.value)} />
            </label>
            <label>
              <span>Requested payment wei</span>
              <input value={requestedPayment} onChange={(event) => setRequestedPayment(event.target.value)} inputMode="numeric" />
            </label>
          </div>
          <button className="secondaryButton wide" onClick={claimTask} disabled={!account || !selectedTask.id || busy !== ""}>
            <UserRound />
            Claim selected task
          </button>
          <label>
            <span>Deliverable summary</span>
            <textarea value={deliverableSummary} onChange={(event) => setDeliverableSummary(event.target.value)} rows={3} />
          </label>
          <label>
            <span>Artifact URLs JSON</span>
            <input value={artifactUrls} onChange={(event) => setArtifactUrls(event.target.value)} />
          </label>
          <button className="primaryButton wide" onClick={submitWork} disabled={!account || !selectedTask.id || busy !== ""}>
            <Send />
            Submit deliverable
          </button>
        </div>
      </section>

      <section className="workspace lower">
        <div className="panel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Balances</p>
              <h2>Credits and maintenance</h2>
            </div>
            <CircleDollarSign />
          </div>
          <div className="metricGrid compact">
            <Metric icon={<Wallet />} label="Agent earnings" value={formatWei(agentBalance)} />
            <Metric icon={<CircleDollarSign />} label="Creator credit" value={formatWei(creatorCredit)} />
            <Metric icon={<ClipboardList />} label="Open tasks" value={String(openTasks.length)} />
            <Metric icon={<Clock3 />} label="Accepted" value={String(tasks.filter((task) => task.status === "ACCEPTED").length)} />
          </div>
          {reputation && (
            <div className="reputation">
              <span>Claimed {reputation.tasks_claimed}</span>
              <span>Accepted {reputation.tasks_accepted}</span>
              <span>Revisions {reputation.revision_rounds}</span>
              <span>Earned {formatWei(reputation.total_earned)}</span>
            </div>
          )}
          <div className="buttonRow">
            <button className="secondaryButton" onClick={loadBalances} disabled={!account || busy !== ""}>
              <RefreshCw />
              Load balances
            </button>
            <input className="inlineInput" value={withdrawAmount} onChange={(event) => setWithdrawAmount(event.target.value)} inputMode="numeric" placeholder="wei amount" />
            <button className="secondaryButton" onClick={() => withdraw("agent")} disabled={!account || busy !== ""}>
              <Download />
              Agent withdraw
            </button>
            <button className="secondaryButton" onClick={() => withdraw("creator")} disabled={!account || busy !== ""}>
              <Download />
              Creator withdraw
            </button>
          </div>
          <div className="buttonRow">
            <button className="ghostButton" onClick={() => maintenanceTx("Release expired assignment", "release_expired_assignment", [BigInt(selectedTask.id || "0")])} disabled={!selectedTask.id || busy !== ""}>
              <Clock3 />
              Release expired
            </button>
            <button className="ghostButton" onClick={() => maintenanceTx("Request replan", "request_replan", [BigInt(mission?.id || missionIdInput || "0"), replanReason])} disabled={!mission || busy !== ""}>
              <GitBranch />
              Replan
            </button>
            <button className="ghostButton danger" onClick={() => maintenanceTx("Cancel mission", "cancel_mission", [BigInt(mission?.id || missionIdInput || "0")])} disabled={!mission || busy !== ""}>
              <AlertTriangle />
              Cancel
            </button>
          </div>
          <label>
            <span>Replan reason</span>
            <input value={replanReason} onChange={(event) => setReplanReason(event.target.value)} />
          </label>
        </div>

        <div className="panel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Transactions</p>
              <h2>Finality and trace</h2>
            </div>
            <Bug />
          </div>
          <div className="txList">
            {txs.length === 0 ? (
              <div className="emptyState">Submitted transactions will appear here.</div>
            ) : (
              txs.map((tx) => (
                <div className="txRow" key={tx.hash}>
                  <div>
                    <strong>{tx.label}</strong>
                    <small>{tx.detail || tx.status}</small>
                    <a href={explorerTxUrl(tx.hash)} target="_blank" rel="noreferrer">
                      {shortAddress(tx.hash)} <ExternalLink />
                    </a>
                  </div>
                  <button className="iconButton" onClick={() => inspectTrace(tx.hash)} title="Load debug trace">
                    <Braces />
                  </button>
                </div>
              ))
            )}
          </div>
          <pre className="trace">{trace || "Debug trace output appears here after selecting a transaction."}</pre>
        </div>
      </section>
    </main>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="metric">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusPill({ label, tone }: { label: string; tone: string }) {
  return <span className={`statusPill ${tone}`}>{label}</span>;
}
