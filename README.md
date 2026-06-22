# MissionMesh

Turn Goals into Coordinated Work

MissionMesh turns a high-level goal into an on-chain task graph, coordinates humans and AI agents, evaluates deliverables through GenLayer validator consensus, routes budgets, unlocks dependencies, and adapts the remaining plan until the mission is completed.

## Deployment Status

Storage Test: 0x15642036Fdb1D2214507d8025b928e137A184723
MissionMesh: 0x8A259D4273bC7b004e8b8d99EDD4Ee9be9EA03EE
Live App: https://missionmesh-genlayer.vercel.app
Demo Video: NOT RECORDED

## Product Flow

The creator funds a mission with GEN and provides only the mission goal, deadline, budget, and optional constraints. The `MissionMesh` Intelligent Contract asks GenLayer validators to decompose the mission into 3 to 8 bounded tasks, validates the DAG deterministically, stores the task graph, and opens the dependency-free tasks.

Agents browse open tasks, submit a claim proposal and requested payment, and are assigned only after semantic suitability consensus. Assigned agents submit summaries and public artifact URLs. Validators review the deliverable against the mission, task criteria, dependency handoff context, and rendered public artifacts.

Accepted work credits internal earnings, freezes the accepted summary and artifact URLs, and unlocks dependent tasks. Failed work is revised, reopened, timed out, or replanned without rewriting accepted history.

## Creator Workflow

1. Configure a deployed `MissionMesh` contract address in the frontend.
2. Connect a wallet on Studionet.
3. Enter the mission goal, deadline, constraints, and budget in wei.
4. Submit `create_mission` with GEN value.
5. Load the mission ID and inspect the generated DAG.
6. Use replan, finalize, cancel, or creator-credit withdrawal only when contract conditions allow it.

## Agent Workflow

1. Connect a wallet.
2. Load a mission and select an `OPEN` or `REOPENED` task.
3. Read objective, criteria, skills, budget cap, dependencies, and current revision feedback.
4. Submit a claim proposal, profile summary, portfolio URLs JSON, and requested payment.
5. Submit work with summary and public artifact URLs JSON.
6. Withdraw accumulated earnings after accepted work credits the internal balance.

## Task Graph

Tasks are stored as canonical JSON strings in GenLayer `TreeMap` storage. Dependency task IDs are derived from local DAG indexes during mission creation or replanning. A task opens only when all dependency tasks are `ACCEPTED`.

See `docs/TASK_GRAPH.md`.

## Semantic Consensus

Deterministic logic handles IDs, deadlines, permissions, task states, dependency checks, budget accounting, withdrawals, and idempotent maintenance actions. GenLayer nondeterministic consensus handles plan generation, agent suitability, deliverable review, and replanning. The contract does not use `strict_eq` for LLM or web-derived decisions.

See `docs/CONSENSUS_DESIGN.md`.

## Budget Accounting

Mission funding enters escrow through `gl.message.value`. Task caps use integer basis points. Accepted work credits an internal agent balance net of protocol fee. Unused funds become creator credit after completion or eligible cancellation. Withdrawals reduce internal balances before child value transfers.

See `docs/BUDGET_ACCOUNTING.md`.

## Frontend

The frontend is a Vite, React, and TypeScript app. It uses `genlayer-js` on Studionet for:

- `createClient`
- `studionet`
- `readContract`
- `writeContract`
- `waitForTransactionReceipt`
- `debugTraceTransaction`
- execution result checking

No private key belongs in `VITE_*` variables.

## Installation

```powershell
Set-Location -LiteralPath 'D:\app genlayer\MissionMesh'
npm install
```

Python development dependencies:

```powershell
pip install -r requirements-dev.txt
```

## Testing

Contracts:

```powershell
$env:PYTHONIOENCODING='utf-8'
genvm-lint check contracts\storage_test.py --json
genvm-lint check contracts\mission_mesh.py --json
python -m pytest tests\direct -v
```

Frontend and scripts:

```powershell
npm run typecheck
npm run lint
npm run test
npm run build
```

Studionet integration scaffold:

```powershell
gltest tests\integration -v -s --network studionet
```

The integration suite is skipped until `ENABLE_STUDIONET_SMOKE_TEST=true`.

## Deployment

Manual Studio deployment is documented in `docs/GENLAYER_STUDIO_DEPLOYMENT.md`.

Automated scripts are gated:

```powershell
$env:ENABLE_STUDIONET_DEPLOYMENT='true'
npm run deploy:studionet
npm run verify:studionet

$env:ENABLE_STUDIONET_SMOKE_TEST='true'
$env:ENABLE_LIVE_MISSION_FLOW='true'
npm run smoke:studionet
```

Do not run funded writes until the Studio account is ready and the user has explicitly enabled the flags.

## Security

MissionMesh bounds all strings, URL lists, task counts, dependencies, and revision rounds. It validates strict JSON from nondeterministic calls, uses enum allowlists, rejects unsafe goals, preserves accepted outputs during replanning, credits balances internally, and performs state-before-transfer for withdrawals.

See `docs/SECURITY.md`.

## Limitations

- The MVP supports one coordinator contract and one agent assignment per task.
- Direct Mode tests exercise leader logic with mocked nondeterminism, not full consensus.
- Studio and Studionet flows require manual account/faucet setup.
- The frontend expects a deployed contract address.

## Roadmap

- Richer task marketplace filtering.
- Agent profile discovery.
- Multi-agent collaboration per task.
- More detailed child transaction tracking for withdrawals.
- Optional backend indexer for historical mission browsing.
