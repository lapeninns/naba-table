import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('@/hooks/ops/useOpsDrinksMenu', () => ({
  useOpsDrinkMenuImportPreview: previewHookMock,
  useOpsDrinkMenuImportApply: applyHookMock,
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

import { DrinkImportDialog } from '@/components/features/menu/DrinkImportDialog';

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

describe('DrinkImportDialog', () => {
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

  it('clears the preview when the selected drink files change', async () => {
    const user = userEvent.setup();
    previewMutateMock.mockResolvedValue(buildResult());

    render(<DrinkImportDialog open onOpenChange={vi.fn()} restaurantId="rest-1" />);

    const itemsInput = screen.getByLabelText('Drinks CSV');
    await user.upload(itemsInput, new File(['first'], 'drinks-a.csv', { type: 'text/csv' }));
    await user.click(screen.getByRole('button', { name: 'Preview import' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Apply import' })).toBeEnabled(),
    );
    expect(screen.getByText('Preview ready')).toBeInTheDocument();

    await user.upload(itemsInput, new File(['second'], 'drinks-b.csv', { type: 'text/csv' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Apply import' })).toBeDisabled(),
    );
    expect(screen.queryByText('Preview ready')).not.toBeInTheDocument();
  });
});
