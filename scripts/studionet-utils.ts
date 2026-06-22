import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { ExecutionResult, TransactionStatus } from "genlayer-js/types";

export type Address = `0x${string}`;
export type TxHash = `0x${string}`;

export interface DeploymentArtifact {
  network: "studionet";
  chainId: 61999;
  rpc: string;
  storageTestAddress?: Address;
  storageTestDeploymentTransaction?: TxHash;
  missionMeshAddress: Address;
  deploymentTransaction: TxHash;
  executionResult: string;
  deployedAt: string;
}

const scriptsDir = dirname(fileURLToPath(import.meta.url));
export const projectRoot = resolve(scriptsDir, "..");
export const deploymentsDir = resolve(projectRoot, "deployments");
export const deploymentArtifactPath = resolve(deploymentsDir, "studionet.json");

config({ path: resolve(projectRoot, ".env") });

export function env(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export function requireEnabled(name: string): void {
  if (env(name).toLowerCase() !== "true") {
    throw new Error(`${name}=true is required before this script sends Studionet writes.`);
  }
}

export function assertStudionetConfig(): void {
  const chainId = Number(env("GENLAYER_CHAIN_ID", "61999"));
  const expectedChainId = 61999;
  const chain = studionet as unknown as { id?: number; name?: string; rpcUrls?: unknown };
  if (chainId !== expectedChainId) {
    throw new Error(`GENLAYER_CHAIN_ID must be ${expectedChainId}; got ${chainId}`);
  }
  if (chain.id !== undefined && Number(chain.id) !== expectedChainId) {
    throw new Error(`genlayer-js studionet chain id mismatch: ${String(chain.id)}`);
  }
  if (env("GENLAYER_NETWORK", "studionet") !== "studionet") {
    throw new Error("GENLAYER_NETWORK must be studionet");
  }
}

export function makeClient() {
  assertStudionetConfig();
  const accountFactory = createAccount as unknown as (privateKey?: string) => unknown;
  const privateKey = env("GENLAYER_PRIVATE_KEY").trim();
  const account = privateKey ? accountFactory(privateKey) : accountFactory();
  const clientFactory = createClient as unknown as (config: Record<string, unknown>) => any;
  return clientFactory({ chain: studionet, account });
}

export async function readContractCode(relativePath: string): Promise<string> {
  return readFile(resolve(projectRoot, relativePath), "utf8");
}

export async function waitForSuccess(client: any, hash: TxHash) {
  const receipt = await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.FINALIZED,
    fullTransaction: false,
  });
  const resultName = String(receipt?.txExecutionResultName ?? receipt?.executionResult ?? "UNKNOWN");
  if (resultName !== ExecutionResult.FINISHED_WITH_RETURN) {
    throw new Error(`Transaction ${hash} finalized without success: ${resultName}`);
  }
  return receipt;
}

export function extractContractAddress(receipt: unknown): Address {
  const direct = findAddressByKey(receipt, ["contract_address", "contractAddress", "contract"]);
  if (direct) return direct;
  throw new Error("Could not extract deployed contract address from receipt.");
}

function findAddressByKey(value: unknown, keys: string[]): Address | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const item = record[key];
    if (typeof item === "string" && /^0x[a-fA-F0-9]{40}$/.test(item)) {
      return item as Address;
    }
  }
  for (const item of Object.values(record)) {
    if (item && typeof item === "object") {
      const nested = findAddressByKey(item, keys);
      if (nested) return nested;
    }
  }
  return null;
}

export async function saveDeploymentArtifact(artifact: DeploymentArtifact): Promise<void> {
  await mkdir(deploymentsDir, { recursive: true });
  await writeFile(deploymentArtifactPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
}

export async function loadDeploymentArtifact(): Promise<DeploymentArtifact> {
  const raw = await readFile(deploymentArtifactPath, "utf8");
  return JSON.parse(raw) as DeploymentArtifact;
}

export function printSafe(title: string, data: object): void {
  const redacted = Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, key.toLowerCase().includes("key") ? "[redacted]" : value])
  );
  console.log(title);
  console.log(JSON.stringify(redacted, null, 2));
}
