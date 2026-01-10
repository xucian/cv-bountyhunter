/**
 * Viem Wallet Service
 * Direct private key wallet implementation using viem
 * Works without CDP API keys - good for development and testing
 */

import {
  createWalletClient,
  createPublicClient,
  http,
  encodeFunctionData,
  parseUnits,
  formatUnits,
  type WalletClient,
  type PublicClient,
  type Account,
  type Chain,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
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
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
] as const;

export class ViemWalletService implements IWalletService {
  private walletClient: WalletClient;
  private publicClient: PublicClient;
  private account: Account;
  private chain: Chain;
  private usdcAddress: `0x${string}`;

  constructor(privateKey: string, network: 'base' | 'base-sepolia' = 'base-sepolia') {
    // Ensure private key has 0x prefix
    const formattedKey = privateKey.startsWith('0x')
      ? (privateKey as `0x${string}`)
      : (`0x${privateKey}` as `0x${string}`);

    this.account = privateKeyToAccount(formattedKey);
    this.chain = network === 'base' ? base : baseSepolia;
    this.usdcAddress = config.x402.usdcAddress as `0x${string}`;

    // Create wallet client for signing transactions
    this.walletClient = createWalletClient({
      account: this.account,
      chain: this.chain,
      transport: http(),
    });

    // Create public client for reading chain state
    this.publicClient = createPublicClient({
      chain: this.chain,
      transport: http(),
    });

    console.log(`[ViemWallet] Initialized on ${network}`);
    console.log(`[ViemWallet] Address: ${this.account.address}`);
    console.log(`[ViemWallet] USDC Contract: ${this.usdcAddress}`);
  }

  async getAddress(): Promise<string> {
    return this.account.address;
  }

  async getBalance(): Promise<number> {
    try {
      const balance = await this.publicClient.readContract({
        address: this.usdcAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [this.account.address],
      });

      // USDC has 6 decimals
      return Number(formatUnits(balance, 6));
    } catch (error) {
      console.error('[ViemWallet] Failed to get balance:', error);
      throw error;
    }
  }

  async sendUSDC(to: string, amount: number): Promise<string> {
    console.log(`[ViemWallet] Sending ${amount} USDC to ${to}`);

    try {
      // Convert amount to USDC units (6 decimals)
      const amountInUnits = parseUnits(amount.toString(), 6);

      // Encode the transfer call
      const data = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [to as `0x${string}`, amountInUnits],
      });

      // Send the transaction
      const hash = await this.walletClient.sendTransaction({
        to: this.usdcAddress,
        data,
        chain: this.chain,
        account: this.account,
      });

      console.log(`[ViemWallet] Transaction sent: ${hash}`);

      // Wait for confirmation
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success') {
        console.log(`[ViemWallet] Transaction confirmed in block ${receipt.blockNumber}`);
        return hash;
      } else {
        throw new Error('Transaction reverted');
      }
    } catch (error) {
      console.error('[ViemWallet] Failed to send USDC:', error);
      throw error;
    }
  }

  async sendTransaction(tx: TransactionRequest): Promise<string> {
    console.log(`[ViemWallet] Sending transaction to ${tx.to}`);

    try {
      const hash = await this.walletClient.sendTransaction({
        to: tx.to as `0x${string}`,
        data: tx.data as `0x${string}` | undefined,
        value: tx.value ?? 0n,
        chain: this.chain,
        account: this.account,
      });

      console.log(`[ViemWallet] Transaction sent: ${hash}`);

      // Wait for confirmation
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success') {
        console.log(`[ViemWallet] Transaction confirmed in block ${receipt.blockNumber}`);
        return hash;
      } else {
        throw new Error('Transaction reverted');
      }
    } catch (error) {
      console.error('[ViemWallet] Failed to send transaction:', error);
      throw error;
    }
  }

  async signTypedData(typedData: TypedData): Promise<string> {
    try {
      const signature = await this.walletClient.signTypedData({
        account: this.account,
        domain: typedData.domain as any,
        types: typedData.types as any,
        primaryType: typedData.primaryType,
        message: typedData.message,
      });

      return signature;
    } catch (error) {
      console.error('[ViemWallet] Failed to sign typed data:', error);
      throw error;
    }
  }

  /**
   * Get native ETH balance (for gas)
   */
  async getEthBalance(): Promise<number> {
    const balance = await this.publicClient.getBalance({
      address: this.account.address,
    });
    return Number(formatUnits(balance, 18));
  }

  /**
   * Get the chain info
   */
  getChainInfo(): { name: string; id: number } {
    return {
      name: this.chain.name,
      id: this.chain.id,
    };
  }
}
