/**
 * Wallet Service Factory
 * Creates the appropriate wallet service based on configuration
 */

import type { IWalletService, WalletServiceConfig } from './types.js';
import { ViemWalletService } from './viem-wallet.js';
import { CDPWalletService } from './cdp-wallet.js';
import { config } from '../../config.js';

export * from './types.js';
export { ViemWalletService } from './viem-wallet.js';
export { CDPWalletService } from './cdp-wallet.js';

/**
 * Create a wallet service based on configuration
 * Priority:
 * 1. If explicit type is specified, use that
 * 2. If CDP API key is configured, use CDP
 * 3. If private key is configured, use Viem
 * 4. Throw error if no credentials
 */
export async function createWalletService(
  options?: Partial<WalletServiceConfig>
): Promise<IWalletService> {
  const network = options?.network || config.x402.network;

  // Determine wallet type
  let walletType = options?.type;

  if (!walletType) {
    // Auto-detect based on available credentials
    if (config.cdp.apiKeyId && config.cdp.apiKeySecret) {
      walletType = 'cdp';
    } else if (options?.privateKey || config.orchestrator.privateKey) {
      walletType = 'viem';
    } else {
      throw new Error(
        'No wallet credentials configured. ' +
          'Set either CDP_API_KEY_ID/CDP_API_KEY_SECRET or ORCHESTRATOR_PRIVATE_KEY'
      );
    }
  }

  console.log(`[WalletFactory] Creating ${walletType} wallet on ${network}`);

  if (walletType === 'cdp') {
    const walletId = options?.walletId || config.orchestrator.walletId;
    const cdpWallet = new CDPWalletService(walletId || undefined, network);
    await cdpWallet.initialize();
    return cdpWallet;
  }

  if (walletType === 'viem') {
    const privateKey = options?.privateKey || config.orchestrator.privateKey;
    if (!privateKey) {
      throw new Error('Private key required for viem wallet');
    }
    return new ViemWalletService(privateKey, network);
  }

  throw new Error(`Unknown wallet type: ${walletType}`);
}

/**
 * Create a wallet service with explicit private key (convenience function)
 */
export function createViemWallet(
  privateKey: string,
  network: 'base' | 'base-sepolia' = 'base-sepolia'
): IWalletService {
  return new ViemWalletService(privateKey, network);
}

/**
 * Create a CDP wallet service (convenience function)
 */
export async function createCDPWallet(
  walletId?: string,
  network: 'base' | 'base-sepolia' = 'base-sepolia'
): Promise<IWalletService> {
  const wallet = new CDPWalletService(walletId, network);
  await wallet.initialize();
  return wallet;
}

/**
 * Validate that a wallet service is properly configured
 */
export async function validateWalletService(wallet: IWalletService): Promise<{
  valid: boolean;
  address: string;
  balance: number;
  error?: string;
}> {
  try {
    const address = await wallet.getAddress();
    const balance = await wallet.getBalance();

    return {
      valid: true,
      address,
      balance,
    };
  } catch (error) {
    return {
      valid: false,
      address: '',
      balance: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
