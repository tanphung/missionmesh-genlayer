import { Address, assertStudionetConfig, env, loadDeploymentArtifact, makeClient, printSafe } from "./studionet-utils.js";

function parseJson(raw: unknown): Record<string, unknown> {
  if (typeof raw !== "string") return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function main() {
  assertStudionetConfig();
  const client = makeClient();
  const artifact = await loadDeploymentArtifact();
  const address = (env("MISSION_MESH_ADDRESS") || artifact.missionMeshAddress) as Address;
  if (!address) {
    throw new Error("No MissionMesh address found in deployments/studionet.json or MISSION_MESH_ADDRESS.");
  }

  const configRaw = await client.readContract({
    address,
    functionName: "get_protocol_config",
    args: [],
    stateStatus: "accepted",
  });
  const config = parseJson(configRaw);
  const schema = await client.getContractSchema({ address });
  const code = await client.getContractCode({ address });

  printSafe("Studionet verification", {
    network: artifact.network,
    chainId: artifact.chainId,
    rpc: artifact.rpc,
    contract: address,
    owner: config.owner,
    minimumMissionBudget: config.minimum_mission_budget,
    protocolFeeBps: config.protocol_fee_bps,
    maximumFeeBps: config.maximum_protocol_fee_bps,
    nextMissionId: config.next_mission_id,
    nextTaskId: config.next_task_id,
    schemaMethods: Array.isArray(schema?.methods) ? schema.methods.length : "unknown",
    codeHeader: typeof code === "string" ? code.split(/\r?\n/).slice(0, 3).join(" | ") : "unknown",
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
