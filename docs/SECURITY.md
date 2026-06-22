# Security

## Threats Covered

- Malicious or unsafe mission input.
- Oversized goal, constraints, profile, proposal, summary, and URL JSON.
- Prompt injection in webpage artifacts.
- Fake or malformed portfolio URLs.
- Oversized or cyclic task graph.
- Forward, duplicate, or self dependencies.
- Budget over-allocation and zero task budgets.
- Duplicate payment and duplicate withdrawal.
- Agent impersonation and unauthorized submission.
- Unauthorized replan or cancellation.
- Creator payment clawback.
- Premature timeout release.
- Revision abuse.
- Cancellation with active work.
- Fabricated LLM URL or malformed JSON.
- Semantic validator disagreement.
- Child transaction failure risk.
- Wrong Studio network.
- Private key leakage.
- Owner verdict override.

## Controls

- Bounded strings and bounded arrays.
- URL scheme validation.
- Strict JSON normalization and enum allowlists.
- Deterministic DAG and budget validation.
- No raw persistent Python dict or list storage fields.
- Internal balances with state-before-transfer.
- Immutable accepted summaries and artifact URLs.
- Independent validator reasoning for semantic decisions.
- No side effects inside leader and validator callbacks.
- Idempotent maintenance actions.
- Execution-result checks in frontend and scripts.
- `.env` ignored and no private key in frontend variables.
- Studionet chain ID verification in scripts.

## Residual Risk

Direct Mode does not execute full consensus. Studio or Studionet integration must be run before claiming production readiness.
