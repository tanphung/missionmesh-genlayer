# GenLayer Studio Deployment

Storage Test: 0x15642036Fdb1D2214507d8025b928e137A184723
MissionMesh: 0x144949Aa034c5f20f25Be57f7b5f2cc4964c5501
Live App: NOT DEPLOYED
Demo Video: NOT RECORDED

## Manual Procedure

1. Open `https://studio.genlayer.com/run-debug`.
2. Open Studio Settings, run `Reset Storage`, and confirm.
3. Hard refresh: Windows `Ctrl+Shift+F5`, macOS `Cmd+Shift+R`.
4. Upload and open `contracts/storage_test.py`.
5. Verify line 1 is `# v0.2.16`, line 2 is the dependency declaration, and line 3 is `from genlayer import *`.
6. Deploy the storage test.
7. Open the deployment transaction and confirm `Status: FINALIZED` and `Result: SUCCESS`. Do not accept `FINALIZED` with `Result: ERROR`.
8. Call `get_storage()` and verify the initial value.
9. Upload and open `contracts/mission_mesh.py`.
10. Set constructor args with integer values, for example `[1, 250]`.
11. Deploy MissionMesh.
12. Open the deployment transaction and inspect result, return value, logs, and traceback.
13. Call `get_protocol_config()` and verify owner, minimum budget, fee bps, and counters.
14. Use the Studio faucet button in the account selector to obtain development GEN.
15. Create the demo mission and inspect the returned mission ID.
16. Configure `frontend/.env` with `VITE_MISSION_MESH_ADDRESS`.
17. Run the frontend and execute the smoke flow.

## Troubleshooting

- `Contract Queues not found`: check line 1 is exactly `# v0.2.16`.
- `Contract IdlenessPhase not found`: reset storage and hard refresh.
- `Contract RevealingPhase not found`: verify runtime version and hard refresh.
- `AssertionError: TreeMap <- TreeMap`: remove `TreeMap()` or `DynArray()` assignments from `__init__`.
- Schema parser error: check floats, raw dict/list storage, unsupported public type annotations, and missing type annotations.
- `module 'genlayer' has no attribute 'Contract'`: use only `from genlayer import *`, not `import genlayer`.
- Sidebar says not deployed but transaction finalized: open the transaction and inspect `Result` and traceback.

## Scripted Deployment

```powershell
Copy-Item .env.example .env
$env:ENABLE_STUDIONET_DEPLOYMENT='true'
npm run deploy:studionet
npm run verify:studionet
```

The deploy script saves `deployments/studionet.json` only after successful finalized execution.
