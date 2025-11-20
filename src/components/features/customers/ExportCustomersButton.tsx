'use client';

import { Download } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'react-hot-toast';

import { Button } from '@/components/ui/button';
import type { CustomerListParams } from '@/services/ops/customers';

type ExportCustomersButtonProps = {
  restaurantId: string | null;
  restaurantName: string;
  disabled?: boolean;
  sort?: 'asc' | 'desc';
  filters?: Pick<CustomerListParams, 'sortBy' | 'search' | 'marketingOptIn' | 'lastVisit' | 'minBookings'>;
};

function buildFallbackFilename(restaurantName: string): string {
  const baseName = restaurantName.trim().toLowerCase() || 'restaurant';
  const safeName = baseName.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'restaurant';
  const date = new Date().toISOString().split('T')[0];
  return `customers-${safeName}-${date}.csv`;
}

function extractFilename(headerValue: string | null, fallback: string): string {
  if (!headerValue) {
    return fallback;
  }

  const filenameStarMatch = headerValue.match(/filename\*=(?:UTF-8'')?([^;]+)/i);
  if (filenameStarMatch?.[1]) {
    try {
      return decodeURIComponent(filenameStarMatch[1].replace(/\"/g, '').trim());
    } catch {
      // fall through to other strategies
    }
  }

  const filenameMatch = headerValue.match(/filename=\"?([^\";]+)\"?/i);
  if (filenameMatch?.[1]) {
    return filenameMatch[1];
  }

  return fallback;
}

export function ExportCustomersButton({ restaurantId, restaurantName, disabled, sort = 'desc', filters }: ExportCustomersButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!restaurantId || disabled) {
      return;
    }

    setIsExporting(true);

    try {
      const params = new URLSearchParams({ restaurantId, sort });

      if (filters?.sortBy) params.set('sortBy', filters.sortBy);
      if (filters?.search) params.set('search', filters.search);
      if (filters?.marketingOptIn && filters.marketingOptIn !== 'all') params.set('marketingOptIn', filters.marketingOptIn);
      if (filters?.lastVisit && filters.lastVisit !== 'any') params.set('lastVisit', filters.lastVisit);
      if (typeof filters?.minBookings === 'number' && filters.minBookings > 0) {
        params.set('minBookings', String(filters.minBookings));
      }

      const response = await fetch(`/api/ops/customers/export?${params.toString()}`, {
        method: 'GET',
        headers: {
          accept: 'text/csv',
        },
      });

      if (!response.ok) {
        throw new Error(`Export failed (${response.status})`);
      }

      const blob = await response.blob();
      const fallbackFilename = buildFallbackFilename(restaurantName);
      const filename = extractFilename(response.headers.get('content-disposition'), fallbackFilename);

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Customer export ready.');
    } catch (error) {
      console.error('[ExportCustomersButton] Export failed', error);
      toast.error('Unable to export customers. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const isDisabled = disabled || !restaurantId || isExporting;

  return (
    <Button
      onClick={handleExport}
      disabled={isDisabled}
      aria-busy={isExporting}
      type="button"
      variant="outline"
      size="sm"
      aria-label={isExporting ? 'Exporting customers...' : 'Export customers to CSV'}
    >
      <Download className="mr-2 h-4 w-4" />
      {isExporting ? 'Exporting...' : 'Export CSV'}
    </Button>
  );
}
