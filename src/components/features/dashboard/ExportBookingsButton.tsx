'use client';

import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'react-hot-toast';

import { Button } from '@/components/ui/button';

type ExportBookingsButtonProps = {
  restaurantId: string;
  restaurantName: string;
  date: string;
  disabled?: boolean;
};

function buildFallbackFilename(restaurantName: string, date: string): string {
  const baseName = restaurantName.trim().toLowerCase() || 'restaurant';
  const safeName = baseName.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'restaurant';
  const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().split('T')[0];
  return `bookings-${safeName}-${safeDate}.csv`;
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
      // fall through to fallback strategies
    }
  }

  const filenameMatch = headerValue.match(/filename=\"?([^\";]+)\"?/i);
  if (filenameMatch?.[1]) {
    return filenameMatch[1];
  }

  return fallback;
}

export function ExportBookingsButton({ restaurantId, restaurantName, date, disabled }: ExportBookingsButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const fallbackFilename = useMemo(() => buildFallbackFilename(restaurantName, date), [restaurantName, date]);

  const handleExport = async () => {
    if (!restaurantId || !date || disabled) {
      return;
    }

    setIsExporting(true);

    try {
      const params = new URLSearchParams({ restaurantId, date });

      const response = await fetch(`/api/ops/bookings/export?${params.toString()}`, {
        method: 'GET',
        headers: {
          accept: 'text/csv',
        },
      });

      if (!response.ok) {
        throw new Error(`Export failed (${response.status})`);
      }

      const blob = await response.blob();
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

      toast.success('Booking export ready.');
    } catch (error) {
      console.error('[ExportBookingsButton] Export failed', error);
      toast.error('Unable to export bookings. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const isDisabled = disabled || isExporting || !restaurantId || !date;

  return (
    <Button
      onClick={handleExport}
      disabled={isDisabled}
      variant="outline"
      size="sm"
      aria-label={isExporting ? 'Exporting bookings...' : `Download bookings for ${date}`}
    >
      <Download className="mr-2 h-4 w-4" aria-hidden />
      {isExporting ? 'Exporting…' : 'Download CSV'}
    </Button>
  );
}
