# Budget Accounting

Mission funding enters through `gl.message.value` in `create_mission`.

## Allocation

Task caps are computed with integer basis points:

```text
task_budget_cap = mission_budget * task_budget_bps / 10000
```

The validated plan must allocate between 85 percent and 95 percent of the funded budget to tasks. The reserve supports retries, reassignment, replanning, and bid differences.

## Acceptance

When a task is accepted:

```text
fee = agreed_payment * protocol_fee_bps / 10000
agent_credit = agreed_payment - fee
```

The mission reserved amount decreases, spent increases, protocol fees accumulate, and the agent internal balance is credited.

## Withdrawals

Agent earnings, creator credits, and protocol fees are internal balances. Withdrawals reduce the internal balance before emitting a child transfer, preventing duplicate withdrawal.

## Refunds

Unused mission funds become creator credit after completion or eligible cancellation. Accepted task payments are never clawed back.
