/**
 * CDP Wallet Service
 * Coinbase Developer Platform wallet implementation
 * Uses managed keys - more secure for production
 * Requires CDP API credentials
 */

import { CdpClient } from '@coinbase/cdp-sdk';
import {
  createPublicClient,
  http,
  encodeFunctionData,
  parseUnits,
  formatUnits,
  type PublicClient,
  type Chain,
} from 'viem';
import { base, baseSepolia } from 'viem/chains';
import type { IWalletService, TransactionRequest, TypedData } from './types.js';
import { config } from '../../config.js';

// Minimal ERC20 ABI for USDC operations
const ERC20_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export class CDPWalletService implements IWalletService {
  private client: CdpClient;
  private account: any; // CDP account type
  private publicClient: PublicClient;
  private chain: Chain;
  private usdcAddress: `0x${string}`;
  private initialized = false;

  constructor(
    private walletId?: string,
    private network: 'base' | 'base-sepolia' = 'base-sepolia'
  ) {
    // Initialize CDP client - uses env vars by default:
    // CDP_API_KEY_ID, CDP_API_KEY_SECRET, CDP_WALLET_SECRET
    this.client = new CdpClient();
    this.chain = network === 'base' ? base : baseSepolia;
    this.usdcAddress = config.x402.usdcAddress as `0x${string}`;

    // Create public client for reading chain state
    this.publicClient = createPublicClient({
      chain: this.chain,
      transport: http(),
    });

    console.log(`[CDPWallet] Initializing on ${network}`);
  }

  /**
   * Initialize the wallet - must be called before other operations
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      if (this.walletId) {
        // Load existing wallet by ID
        console.log(`[CDPWallet] Loading wallet: ${this.walletId}`);
        this.account = await this.client.evm.getAccount({
          address: this.walletId as `0x${string}`,
        });
      } else {
        // Create a new wallet
        console.log('[CDPWallet] Creating new wallet...');
        this.account = await this.client.evm.createAccount();
        console.log(`[CDPWallet] Created wallet: ${this.account.address}`);
      }

      this.initialized = true;
      console.log(`[CDPWallet] Initialized with address: ${this.account.address}`);
    } catch (error) {
      console.error('[CDPWallet] Failed to initialize:', error);
      throw error;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  async getAddress(): Promise<string> {
    await this.ensureInitialized();
    return this.account.address;
  }

  async getBalance(): Promise<number> {
    await this.ensureInitialized();

    try {
      const balance = await this.publicClient.readContract({
        address: this.usdcAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [this.account.address as `0x${string}`],
      });

      // USDC has 6 decimals
      return Number(formatUnits(balance, 6));
    } catch (error) {
      console.error('[CDPWallet] Failed to get balance:', error);
      throw error;
    }
  }

  async sendUSDC(to: string, amount: number): Promise<string> {
    await this.ensureInitialized();
    console.log(`[CDPWallet] Sending ${amount} USDC to ${to}`);

    try {
      // Convert amount to USDC units (6 decimals)
      const amountInUnits = parseUnits(amount.toString(), 6);

      // Encode the transfer call
      const data = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [to as `0x${string}`, amountInUnits],
      });

      // Send via CDP using the correct API format
      // See: https://docs.cdp.coinbase.com/server-wallets/v2/introduction/quickstart
      const transactionResult = await this.client.evm.sendTransaction({
        address: this.account.address as `0x${string}`,
        transaction: {
          to: this.usdcAddress,
          data,
          value: 0n,
        },
        network: this.network,
      });

      const hash = transactionResult.transactionHash;
      console.log(`[CDPWallet] Transaction sent: ${hash}`);

      // Wait for confirmation using public client
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: hash as `0x${string}`,
      });

      if (receipt.status === 'success') {
        console.log(`[CDPWallet] Transaction confirmed in block ${receipt.blockNumber}`);
        return hash;
      } else {
        throw new Error('Transaction reverted');
      }
    } catch (error) {
      console.error('[CDPWallet] Failed to send USDC:', error);
      throw error;
    }
  }

  async sendTransaction(tx: TransactionRequest): Promise<string> {
    await this.ensureInitialized();
    console.log(`[CDPWallet] Sending transaction to ${tx.to}`);

    try {
      // Use correct CDP API format
      const transactionResult = await this.client.evm.sendTransaction({
        address: this.account.address as `0x${string}`,
        transaction: {
          to: tx.to as `0x${string}`,
          data: (tx.data || '0x') as `0x${string}`,
          value: tx.value ?? 0n,
        },
        network: this.network,
      });

      const hash = transactionResult.transactionHash;
      console.log(`[CDPWallet] Transaction sent: ${hash}`);

      // Wait for confirmation
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: hash as `0x${string}`,
      });

      if (receipt.status === 'success') {
        console.log(`[CDPWallet] Transaction confirmed in block ${receipt.blockNumber}`);
        return hash;
      } else {
        throw new Error('Transaction reverted');
      }
    } catch (error) {
      console.error('[CDPWallet] Failed to send transaction:', error);
      throw error;
    }
  }

  async signTypedData(typedData: TypedData): Promise<string> {
    await this.ensureInitialized();

    try {
      // CDP SDK should support EIP-712 signing
      const signature = await this.account.signTypedData({
        domain: typedData.domain,
        types: typedData.types,
        primaryType: typedData.primaryType,
        message: typedData.message,
      });

      return signature;
    } catch (error) {
      console.error('[CDPWallet] Failed to sign typed data:', error);
      throw error;
    }
  }

  /**
   * Export the wallet address (useful for getting the wallet ID after creation)
   */
  async getWalletInfo(): Promise<{ address: string; network: string }> {
    await this.ensureInitialized();
    return {
      address: this.account.address,
      network: this.network,
    };
  }
}
