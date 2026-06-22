import {
  DeploymentArtifact,
  TxHash,
  env,
  extractContractAddress,
  makeClient,
  printSafe,
  readContractCode,
  requireEnabled,
  saveDeploymentArtifact,
  waitForSuccess,
} from "./studionet-utils.js";

async function deployContract(client: any, label: string, code: string, args: unknown[] = []) {
  const hash = (await client.deployContract({
    code,
    args,
    leaderOnly: false,
  })) as TxHash;
  console.log(`${label} deployment submitted: ${hash}`);
  const receipt = await waitForSuccess(client, hash);
  const address = extractContractAddress(receipt);
  console.log(`${label} deployed at ${address}`);
  return { hash, address, receipt };
}

async function main() {
  requireEnabled("ENABLE_STUDIONET_DEPLOYMENT");
  const client = makeClient();
  const rpc = env("GENLAYER_RPC", "https://studio.genlayer.com/api");
  const deployStorage = env("DEPLOY_STORAGE_TEST", "true").toLowerCase() !== "false";
  const minimumMissionBudget = BigInt(env("MINIMUM_MISSION_BUDGET_WEI", "1") || "1");
  const protocolFeeBps = BigInt(env("PROTOCOL_FEE_BPS", "250") || "250");

  printSafe("Studionet deploy configuration", {
    network: env("GENLAYER_NETWORK", "studionet"),
    chainId: Number(env("GENLAYER_CHAIN_ID", "61999")),
    rpc,
    deployStorage,
    minimumMissionBudget: minimumMissionBudget.toString(),
    protocolFeeBps: protocolFeeBps.toString(),
    privateKeyConfigured: Boolean(env("GENLAYER_PRIVATE_KEY")),
  });

  let storageTestAddress: DeploymentArtifact["storageTestAddress"];
  let storageTestDeploymentTransaction: DeploymentArtifact["storageTestDeploymentTransaction"];

  if (deployStorage) {
    const storageCode = await readContractCode("contracts/storage_test.py");
    const storage = await deployContract(client, "Storage Test", storageCode, ["MissionMesh storage sanity"]);
    storageTestAddress = storage.address;
    storageTestDeploymentTransaction = storage.hash;
  }

  const missionCode = await readContractCode("contracts/mission_mesh.py");
  const mission = await deployContract(client, "MissionMesh", missionCode, [minimumMissionBudget, protocolFeeBps]);
  const configRaw = await client.readContract({
    address: mission.address,
    functionName: "get_protocol_config",
    args: [],
    stateStatus: "accepted",
  });

  const artifact: DeploymentArtifact = {
    network: "studionet",
    chainId: 61999,
    rpc,
    storageTestAddress,
    storageTestDeploymentTransaction,
    missionMeshAddress: mission.address,
    deploymentTransaction: mission.hash,
    executionResult: "SUCCESS",
    deployedAt: new Date().toISOString(),
  };
  await saveDeploymentArtifact(artifact);
  printSafe("Deployment artifact saved", artifact);
  console.log("get_protocol_config result:");
  console.log(typeof configRaw === "string" ? configRaw : JSON.stringify(configRaw, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
