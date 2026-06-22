# Consensus Design

MissionMesh uses deterministic contract logic for state transitions and GenLayer nondeterministic consensus for semantic judgments.

## Nondeterministic Decisions

- Mission decomposition.
- Agent suitability.
- Deliverable review.
- Mission replanning.

Each decision has a leader callback and validator callback. Validators independently generate or review the same material decision and then apply deterministic equivalence rules.

## Equivalence

The contract does not require exact wording equality for semantic outputs. It requires material agreement on task count, dependency graph, final integration position, deliverable type, budget split tolerance, assignment versus rejection, and accept versus revision versus reject.

## LLM Output Handling

Outputs are requested as JSON, parsed defensively, normalized, checked against allowlists, and rejected with bounded error classes such as `[EXPECTED]` and `[LLM_ERROR]`.

## Web Artifacts

Deliverable review renders submitted URLs as untrusted public content. Prompt injection text in artifact pages is treated as evidence to evaluate, not as instructions for the validator.
