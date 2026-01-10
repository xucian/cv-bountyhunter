/**
 * Wallet Service Types
 * Abstracts wallet operations for x402 payments
 */

export interface IWalletService {
  /**
   * Get the wallet's public address
   */
  getAddress(): Promise<string>;

  /**
   * Get the wallet's USDC balance
   */
  getBalance(): Promise<number>;

  /**
   * Send USDC to a recipient
   * @param to - Recipient address
   * @param amount - Amount in USDC (human-readable, e.g., 10.5)
   * @returns Transaction hash
   */
  sendUSDC(to: string, amount: number): Promise<string>;

  /**
   * Send a raw transaction
   * @param tx - Transaction parameters
   * @returns Transaction hash
   */
  sendTransaction(tx: TransactionRequest): Promise<string>;

  /**
   * Sign typed data (EIP-712) for x402 payments
   * @param typedData - EIP-712 typed data
   * @returns Signature
   */
  signTypedData(typedData: TypedData): Promise<string>;
}

export interface TransactionRequest {
  to: string;
  data?: string;
  value?: bigint;
  gasLimit?: bigint;
}

export interface TypedData {
  domain: {
    name?: string;
    version?: string;
    chainId?: number;
    verifyingContract?: string;
  };
  types: Record<string, Array<{ name: string; type: string }>>;
  primaryType: string;
  message: Record<string, unknown>;
}

export interface WalletServiceConfig {
  type: 'viem' | 'cdp';
  // For viem wallet
  privateKey?: string;
  // For CDP wallet
  walletId?: string;
  // Network
  network?: 'base' | 'base-sepolia';
}

export interface WalletInfo {
  address: string;
  balance: number;
  network: string;
}
