import { afterEach, describe, expect, it, vi } from 'vitest';

import { defaultErrorReporter } from '@shared/error/errorReporter';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('defaultErrorReporter', () => {
  it('logs the raw error outside production @contract', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = new Error('draft failed');

    defaultErrorReporter.capture(failure);

    expect(errorSpy).toHaveBeenCalledWith('[error]', failure);
  });

  it('includes non-empty context in the log @contract', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = new Error('draft failed');

    defaultErrorReporter.capture(failure, { scope: 'wizard.storage' });

    expect(errorSpy).toHaveBeenCalledWith('[error]', { scope: 'wizard.storage' }, failure);
  });

  it('collapses an empty context object to undefined @contract', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = new Error('draft failed');

    defaultErrorReporter.capture(failure, {});

    expect(errorSpy).toHaveBeenCalledWith('[error]', undefined, failure);
  });
});
