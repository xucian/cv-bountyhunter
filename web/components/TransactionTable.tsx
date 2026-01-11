'use client';

import { cn } from '@/lib/utils';
import type { PaymentRecord } from '@/lib/services';
import { ExternalLink, Check, Clock, XCircle } from 'lucide-react';

interface TransactionTableProps {
  payments: PaymentRecord[];
  network?: string;
}

const EXPLORER_URL = 'https://sepolia.basescan.org';

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function truncateHash(hash: string): string {
  if (!hash) return '—';
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

function StatusBadge({ status }: { status: PaymentRecord['status'] }) {
  const statusConfig = {
    confirmed: {
      icon: Check,
      label: 'Confirmed',
      className: 'text-green-500 bg-green-500/10',
    },
    pending: {
      icon: Clock,
      label: 'Pending',
      className: 'text-yellow-500 bg-yellow-500/10',
    },
    failed: {
      icon: XCircle,
      label: 'Failed',
      className: 'text-red-500 bg-red-500/10',
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium', config.className)}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

export function TransactionTable({ payments, network = 'Base Sepolia' }: TransactionTableProps) {
  if (payments.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg">No transactions yet</p>
        <p className="text-sm mt-1">Payments will appear here when the agent wins competitions</p>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-5 gap-4 p-3 bg-muted/50 text-sm font-medium text-muted-foreground">
        <div>Date</div>
        <div>Competition</div>
        <div className="text-right">Amount</div>
        <div className="text-center">Status</div>
        <div className="text-right">Transaction</div>
      </div>

      {/* Rows */}
      {payments.map((payment) => (
        <div
          key={payment.id}
          className="grid grid-cols-5 gap-4 p-3 items-center border-t border-border hover:bg-muted/30 transition-colors"
        >
          {/* Date */}
          <div className="text-sm text-muted-foreground">
            {formatDate(payment.createdAt)}
          </div>

          {/* Competition ID */}
          <div className="font-mono text-xs text-muted-foreground">
            {truncateHash(payment.competitionId)}
          </div>

          {/* Amount */}
          <div className="text-right font-mono text-green-500 font-medium">
            ${payment.amount.toFixed(2)}
          </div>

          {/* Status */}
          <div className="text-center">
            <StatusBadge status={payment.status} />
          </div>

          {/* Transaction Hash */}
          <div className="text-right">
            {payment.txHash ? (
              <a
                href={`${EXPLORER_URL}/tx/${payment.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-mono text-primary hover:underline"
              >
                {truncateHash(payment.txHash)}
                <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <span className="text-muted-foreground text-xs">—</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default TransactionTable;
