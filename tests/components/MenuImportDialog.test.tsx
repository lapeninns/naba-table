import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const {
  previewMutateMock,
  applyMutateMock,
  previewHookMock,
  applyHookMock,
  toastSuccessMock,
  toastErrorMock,
} = vi.hoisted(() => ({
  previewMutateMock: vi.fn(),
  applyMutateMock: vi.fn(),
  previewHookMock: vi.fn(),
  applyHookMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock('@/hooks/ops/useOpsMenu', () => ({
  useOpsMenuImportPreview: previewHookMock,
  useOpsMenuImportApply: applyHookMock,
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

import { MenuImportDialog } from '@/components/features/menu/MenuImportDialog';

function buildResult() {
  return {
    applied: false as const,
    canApply: true,
    summary: {
      itemRows: 1,
      modifierGroupRows: 0,
      modifierOptionRows: 0,
      itemsToCreate: 1,
      itemsToUpdate: 0,
      modifierGroupsToCreate: 0,
      modifierGroupsToUpdate: 0,
      modifierOptionsToCreate: 0,
      modifierOptionsToUpdate: 0,
      impactedItemCount: 1,
      replaceModifiers: false,
    },
    errors: [],
  };
}

describe('MenuImportDialog', () => {
  beforeEach(() => {
    previewMutateMock.mockReset();
    applyMutateMock.mockReset();
    previewHookMock.mockReset();
    applyHookMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();

    previewHookMock.mockReturnValue({
      mutateAsync: previewMutateMock,
      isPending: false,
    });
    applyHookMock.mockReturnValue({
      mutateAsync: applyMutateMock,
      isPending: false,
    });
  });

  it('clears the preview when the selected menu files change', async () => {
    const user = userEvent.setup();
    previewMutateMock.mockResolvedValue(buildResult());

    render(<MenuImportDialog open onOpenChange={vi.fn()} restaurantId="rest-1" />);

    const itemsInput = screen.getByLabelText('Items CSV');
    await user.upload(itemsInput, new File(['first'], 'items-a.csv', { type: 'text/csv' }));
    await user.click(screen.getByRole('button', { name: 'Preview import' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Apply import' })).toBeEnabled(),
    );
    expect(screen.getByText('Preview ready')).toBeInTheDocument();

    await user.upload(itemsInput, new File(['second'], 'items-b.csv', { type: 'text/csv' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Apply import' })).toBeDisabled(),
    );
    expect(screen.queryByText('Preview ready')).not.toBeInTheDocument();
  });
});
