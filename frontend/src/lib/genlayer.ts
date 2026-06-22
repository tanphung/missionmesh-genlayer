import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { ExecutionResult, TransactionStatus } from "genlayer-js/types";

export type Address = `0x${string}`;
export type TxHash = `0x${string}`;

const makeClient = createClient as unknown as (config: Record<string, unknown>) => any;

export const readClient = makeClient({ chain: studionet });

export function createWalletClient(account: Address) {
  return makeClient({
    chain: studionet,
    account,
    provider: window.ethereum
  });
}

export async function connectWallet(): Promise<Address> {
  if (!window.ethereum) {
    throw new Error("Wallet provider not found");
  }
  const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as string[];
  if (!accounts?.[0]) {
    throw new Error("No wallet account returned");
  }
  const account = accounts[0] as Address;
  const client = createWalletClient(account);
  if (typeof client.connect === "function") {
    await client.connect("studionet");
  }
  return account;
}

export async function readContract<T>(address: Address, functionName: string, args: unknown[] = []): Promise<T> {
  return (await readClient.readContract({
    address,
    functionName,
    args,
    stateStatus: "accepted"
  })) as T;
}

export async function writeContract(
  account: Address,
  address: Address,
  functionName: string,
  args: unknown[],
  value: bigint = 0n
): Promise<TxHash> {
  const client = createWalletClient(account);
  return (await client.writeContract({
    address,
    functionName,
    args,
    value
  })) as TxHash;
}

export async function waitForFinalized(hash: TxHash) {
  return readClient.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.FINALIZED,
    fullTransaction: false
  });
}

export async function debugTrace(hash: TxHash) {
  return readClient.debugTraceTransaction({ hash, round: 0 });
}

export function executionSucceeded(receipt: any): boolean {
  return receipt?.txExecutionResultName === ExecutionResult.FINISHED_WITH_RETURN;
}

export function explorerTxUrl(hash: string): string {
  const base = import.meta.env.VITE_GENLAYER_EXPLORER || "https://explorer-studio.genlayer.com";
  return `${base.replace(/\/$/, "")}/tx/${hash}`;
}
