import type { IPaymentService } from '../../types/services.js';
import type { PaymentRequest } from '../../types/index.js';

export class RealPaymentService implements IPaymentService {
  async requestPayment(
    agentId: string,
    amount: number
  ): Promise<PaymentRequest> {
    throw new Error('RealPaymentService.requestPayment() not implemented');
  }

  async verifyPayment(signature: string): Promise<boolean> {
    throw new Error('RealPaymentService.verifyPayment() not implemented');
  }

  async sendBonus(walletAddress: string, amount: number): Promise<string> {
    throw new Error('RealPaymentService.sendBonus() not implemented');
  }
}
