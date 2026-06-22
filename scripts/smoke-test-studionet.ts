import {
  Address,
  TxHash,
  env,
  loadDeploymentArtifact,
  makeClient,
  printSafe,
  requireEnabled,
  waitForSuccess,
} from "./studionet-utils.js";

function parseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function explorerTx(hash: TxHash): string {
  return `${env("GENLAYER_EXPLORER", "https://explorer-studio.genlayer.com").replace(/\/$/, "")}/tx/${hash}`;
}

async function main() {
  requireEnabled("ENABLE_STUDIONET_SMOKE_TEST");
  requireEnabled("ENABLE_LIVE_MISSION_FLOW");
  const client = makeClient();
  const artifact = await loadDeploymentArtifact();
  const address = (env("MISSION_MESH_ADDRESS") || artifact.missionMeshAddress) as Address;
  const demoBudget = BigInt(env("DEMO_MISSION_BUDGET_WEI", env("MINIMUM_MISSION_BUDGET_WEI", "1")) || "1");
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60);

  const configRaw = await client.readContract({
    address,
    functionName: "get_protocol_config",
    args: [],
    stateStatus: "accepted",
  });
  const config = parseJson<Record<string, number>>(configRaw, {});
  const missionId = Number(config.next_mission_id ?? 1);

  const goal =
    "Build and launch a responsive landing page for an AI scheduling assistant. The final result must include public research notes, final copy, a public design artifact, a source repository, a live deployment, and a compact launch kit.";
  const constraints =
    "Use public artifacts only. Do not request private credentials. The deployment and launch kit must be verifiable by URLs.";

  const hash = (await client.writeContract({
    address,
    functionName: "create_mission",
    args: [goal, constraints, deadline],
    value: demoBudget,
  })) as TxHash;
  console.log(`Demo mission write submitted: ${hash}`);
  await waitForSuccess(client, hash);

  const [missionRaw, taskIdsRaw] = await Promise.all([
    client.readContract({
      address,
      functionName: "get_mission",
      args: [BigInt(missionId)],
      stateStatus: "accepted",
    }),
    client.readContract({
      address,
      functionName: "get_mission_task_ids",
      args: [BigInt(missionId)],
      stateStatus: "accepted",
    }),
  ]);
  const taskIds = parseJson<number[]>(taskIdsRaw, []);
  const tasks = await Promise.all(
    taskIds.map((taskId) =>
      client.readContract({
        address,
        functionName: "get_task",
        args: [BigInt(taskId)],
        stateStatus: "accepted",
      })
    )
  );

  printSafe("Studionet smoke result", {
    contract: address,
    missionId,
    tx: hash,
    explorer: explorerTx(hash),
    mission: parseJson<Record<string, unknown>>(missionRaw, {}),
    taskCount: taskIds.length,
    taskIds,
    taskGraph: tasks.map((task) => parseJson<Record<string, unknown>>(task, {})),
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
