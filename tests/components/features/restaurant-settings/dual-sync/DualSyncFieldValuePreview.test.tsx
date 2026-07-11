import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DualSyncFieldValuePreview } from '@/components/features/restaurant-settings/dual-sync/DualSyncFieldValuePreview';

describe('DualSyncFieldValuePreview', () => {
  it('@smoke renders the label with a formatted string value', () => {
    render(<DualSyncFieldValuePreview label="Nabatable value" value="Old Crown Girton" />);

    expect(screen.getByText('Nabatable value')).toBeInTheDocument();
    expect(screen.getByText('Old Crown Girton')).toBeInTheDocument();
  });

  it('@smoke formats empty values with a placeholder instead of crashing', () => {
    render(<DualSyncFieldValuePreview label="Google value" value={null} />);

    expect(screen.getByText('Google value')).toBeInTheDocument();
    // The domain formatter renders a human placeholder for null-ish values.
    expect(screen.getByText('Google value').nextElementSibling?.textContent).not.toHaveLength(0);
  });
});
