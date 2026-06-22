# Task Graph

MissionMesh stores a bounded directed acyclic graph of 3 to 8 tasks. Each task has an objective, required skills, deliverable type, acceptance criteria, dependency task IDs, duration, budget cap, and final-integration marker.

## Validation

The contract rejects duplicate or missing local indexes, forward dependencies, self dependencies, negative dependencies, more than four dependencies, invalid deliverable types, invalid budget allocation, zero task budgets, and anything other than exactly one final integration task.

## Unlocking

Tasks with no dependencies start as `OPEN`. Dependent tasks start as `LOCKED`. When an accepted task is stored, the contract refreshes availability and opens tasks whose dependencies are all accepted.

## Handoff

`get_task_context(task_id)` returns mission context, task details, dependency summaries, dependency artifact URLs, agreed payment, deadline, and current revision feedback as canonical JSON.
