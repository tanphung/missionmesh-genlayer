# Architecture

Storage Test: 0x15642036Fdb1D2214507d8025b928e137A184723
MissionMesh: 0x144949Aa034c5f20f25Be57f7b5f2cc4964c5501
Live App: NOT DEPLOYED
Demo Video: NOT RECORDED

## Components

- `contracts/storage_test.py`: Studio compatibility sanity contract.
- `contracts/mission_mesh.py`: Mission coordinator Intelligent Contract.
- `frontend/`: React and TypeScript dApp using `genlayer-js` on Studionet.
- `scripts/`: gated Studionet deploy, verify, and smoke-test scripts.
- `tests/direct/`: Direct Mode contract tests with mocked LLM and web calls.
- `tests/integration/`: skipped-by-default Studionet scaffold.
- `demo-artifacts/`: isolated public artifact fixtures.

## Contract Shape

The coordinator persists missions, task IDs, task records, profiles, reputations, agent balances, and creator credits in GenLayer storage types. Mission and task records are canonical JSON strings stored in `TreeMap[str, str]`, while money values use `u256`.

## Frontend Shape

The dApp has no centralized backend. It reads canonical JSON from view methods, parses it safely, and sends writes through the connected wallet. It shows submitted, finalized, and failed transaction states and exposes debug trace loading.

## Data Authority

Contract state is authoritative. Browser state is used only for unsent form drafts, cached reads, saved contract address, and transaction display.
