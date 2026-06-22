import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { ExecutionResult, TransactionStatus } from "genlayer-js/types";

export type Address = `0x${string}`;
export type TxHash = `0x${string}`;

interface EIP6963ProviderDetail {
  info: { uuid: string; name: string; icon: string; rdns: string };
  provider: Window["ethereum"];
}

export const GENLAYER_CHAIN_ID = Number(import.meta.env.VITE_GENLAYER_CHAIN_ID || "61999");
export const GENLAYER_CHAIN_ID_HEX = `0x${GENLAYER_CHAIN_ID.toString(16)}`;
export const GENLAYER_RPC = import.meta.env.VITE_GENLAYER_RPC || "https://studio.genlayer.com/api";
export const GENLAYER_EXPLORER = import.meta.env.VITE_GENLAYER_EXPLORER || "https://explorer-studio.genlayer.com";

export const GENLAYER_NETWORK = {
  chainId: GENLAYER_CHAIN_ID_HEX,
  chainName: "GenLayer Studio",
  nativeCurrency: {
    name: "GEN",
    symbol: "GEN",
    decimals: 18
  },
  rpcUrls: [GENLAYER_RPC],
  blockExplorerUrls: [GENLAYER_EXPLORER]
};

const makeClient = createClient as unknown as (config: Record<string, unknown>) => any;
const RECEIPT_RETRIES = 200;
const RECEIPT_INTERVAL_MS = 3000;

const discoveredWallets: EIP6963ProviderDetail[] = [];

function recordWallet(detail?: EIP6963ProviderDetail) {
  if (!detail?.info?.uuid || !detail.provider) return;
  if (!discoveredWallets.some((wallet) => wallet.info.uuid === detail.info.uuid)) {
    discoveredWallets.push(detail);
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("eip6963:announceProvider", (event) => {
    recordWallet((event as CustomEvent<EIP6963ProviderDetail>).detail);
  });
  window.dispatchEvent(new Event("eip6963:requestProvider"));
}

export function subscribeToWalletDiscovery(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (event: Event) => {
    recordWallet((event as CustomEvent<EIP6963ProviderDetail>).detail);
    callback();
  };
  window.addEventListener("eip6963:announceProvider", handler);
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  return () => window.removeEventListener("eip6963:announceProvider", handler);
}

export function getEthereumProvider(): Window["ethereum"] | null {
  if (typeof window === "undefined") return null;
  if (window.ethereum) return window.ethereum;
  return discoveredWallets[0]?.provider ?? null;
}

export function isWalletInstalled(): boolean {
  return Boolean(getEthereumProvider());
}

function clientConfig(account?: Address | null, includeProvider = false): Record<string, unknown> {
  const config: Record<string, unknown> = {
    chain: studionet,
    endpoint: GENLAYER_RPC
  };
  if (account) config.account = account;
  if (includeProvider) {
    const provider = getEthereumProvider();
    if (provider) config.provider = provider;
  }
  return config;
}

export const readClient = makeClient(clientConfig());

export function createWalletClient(account: Address) {
  return makeClient(clientConfig(account, true));
}

export async function getAccounts(): Promise<Address[]> {
  const provider = getEthereumProvider();
  if (!provider) return [];
  try {
    return (await provider.request({ method: "eth_accounts" })) as Address[];
  } catch {
    return [];
  }
}

export async function getCurrentChainId(): Promise<string | null> {
  const provider = getEthereumProvider();
  if (!provider) return null;
  try {
    return (await provider.request({ method: "eth_chainId" })) as string;
  } catch {
    return null;
  }
}

export async function isOnGenLayerNetwork(): Promise<boolean> {
  const chainId = await getCurrentChainId();
  if (!chainId) return false;
  return Number.parseInt(chainId, 16) === GENLAYER_CHAIN_ID;
}

export async function addGenLayerNetwork(): Promise<void> {
  const provider = getEthereumProvider();
  if (!provider) throw new Error("No wallet detected");
  await provider.request({
    method: "wallet_addEthereumChain",
    params: [GENLAYER_NETWORK]
  });
}

export async function switchToGenLayerNetwork(): Promise<void> {
  const provider = getEthereumProvider();
  if (!provider) throw new Error("No wallet detected");
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: GENLAYER_CHAIN_ID_HEX }]
    });
  } catch (error) {
    const walletError = error as { code?: number; message?: string };
    if (walletError.code === 4902) {
      await addGenLayerNetwork();
      return;
    }
    if (walletError.code === 4001) {
      throw new Error("User rejected switching to GenLayer Studio");
    }
    throw new Error(`Failed to switch to GenLayer Studio: ${walletError.message ?? String(error)}`);
  }
}

export async function ensureGenLayerNetwork(): Promise<void> {
  if (await isOnGenLayerNetwork()) return;
  await switchToGenLayerNetwork();
  if (!(await isOnGenLayerNetwork())) {
    throw new Error("Please switch your wallet to GenLayer Studio before signing.");
  }
}

export async function connectWallet(): Promise<Address> {
  const provider = getEthereumProvider();
  if (!provider) {
    throw new Error("No wallet detected. Please install MetaMask, OKX, Coinbase, or another Web3 wallet.");
  }
  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
  if (!accounts?.[0]) {
    throw new Error("No wallet account returned");
  }
  await ensureGenLayerNetwork();
  const account = accounts[0] as Address;
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
  await ensureGenLayerNetwork();
  const client = createWalletClient(account);
  return (await client.writeContract({
    address,
    functionName,
    args,
    value
  })) as TxHash;
}

export async function waitForAccepted(hash: TxHash) {
  return readClient.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
    interval: RECEIPT_INTERVAL_MS,
    retries: RECEIPT_RETRIES
  } as Record<string, unknown>);
}

export async function debugTrace(hash: TxHash) {
  return readClient.debugTraceTransaction({ hash, round: 0 });
}

export function executionSucceeded(receipt: any): boolean {
  const statusNameByNumber: Record<string, string> = {
    "5": "ACCEPTED",
    "6": "UNDETERMINED",
    "7": "FINALIZED",
    "8": "CANCELED",
    "12": "VALIDATORS_TIMEOUT",
    "13": "LEADER_TIMEOUT"
  };
  const statusName = String(
    receipt?.statusName ?? receipt?.status_name ?? statusNameByNumber[String(receipt?.status)] ?? ""
  ).toUpperCase();
  if (["UNDETERMINED", "CANCELED", "VALIDATORS_TIMEOUT", "LEADER_TIMEOUT"].includes(statusName)) {
    return false;
  }

  const resultNameByNumber: Record<string, string> = {
    "1": "AGREE",
    "2": "DISAGREE",
    "3": "TIMEOUT",
    "4": "DETERMINISTIC_VIOLATION",
    "5": "NO_MAJORITY",
    "6": "MAJORITY_AGREE",
    "7": "MAJORITY_DISAGREE"
  };
  const resultName = String(
    receipt?.resultName ?? receipt?.result_name ?? resultNameByNumber[String(receipt?.result)] ?? ""
  ).toUpperCase();
  if (["DISAGREE", "TIMEOUT", "DETERMINISTIC_VIOLATION", "NO_MAJORITY", "MAJORITY_DISAGREE"].includes(resultName)) {
    return false;
  }

  const executionResult = String(
    receipt?.txExecutionResultName ??
      receipt?.tx_execution_result_name ??
      receipt?.executionResultName ??
      receipt?.execution_result_name ??
      receipt?.executionResult?.name ??
      ""
  ).toUpperCase();
  if (executionResult.includes("ERROR") || executionResult.includes("FAIL") || executionResult.includes("REVERT")) {
    return false;
  }

  return (
    statusName === "ACCEPTED" ||
    statusName === "FINALIZED" ||
    resultName === "AGREE" ||
    resultName === "MAJORITY_AGREE" ||
    resultName === "SUCCESS" ||
    receipt?.txExecutionResultName === ExecutionResult.FINISHED_WITH_RETURN
  );
}

export function explorerTxUrl(hash: string): string {
  const base = import.meta.env.VITE_GENLAYER_EXPLORER || "https://explorer-studio.genlayer.com";
  return `${base.replace(/\/$/, "")}/tx/${hash}`;
}
