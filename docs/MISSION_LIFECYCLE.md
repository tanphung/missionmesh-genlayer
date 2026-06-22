# Mission Lifecycle

Allowed mission statuses are `ACTIVE`, `PAUSED`, `COMPLETED`, `CANCELLED`, and `FAILED`.

## ACTIVE

The mission has unfinished tasks and can continue. Public keeper actions may refresh task availability or finalize the mission if every required task is accepted.

## PAUSED

The mission needs creator action or replanning. The contract pauses when retry limits are reached or the remaining plan cannot safely continue.

## COMPLETED

All tasks are accepted and the final integration task is accepted. Remaining spendable budget becomes creator credit.

## CANCELLED

The creator may cancel only when no task is actively assigned. Accepted payments remain preserved and unfinished tasks are cancelled.

## FAILED

The mission fails when no valid replan remains, maximum replan rounds are exhausted, or remaining budget cannot support unfinished work.
