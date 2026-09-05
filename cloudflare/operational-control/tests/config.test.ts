import { describe, expect, it } from 'vitest';

import { baseEnv, GATE_WORKFLOW_ID } from './helpers/fixtures';
import { isConfiguredValue, resolveControlPlaneConfig } from '../src/config';
import { DEFAULT_REQUIRED_HOSTED_WORKFLOWS } from '../src/contracts';

describe('control plane configuration', () => {
  it('resolves numeric ids, the protected ref and default hosted workflows', () => {
    const result = resolveControlPlaneConfig(baseEnv());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config).toEqual({
      repositoryId: '123456789',
      localCiAppId: 424242,
      gateWorkflowId: GATE_WORKFLOW_ID,
      fallbackWorkflowId: '1002',
      scheduledValidationWorkflowId: '1003',
      protectedRef: 'refs/heads/main',
      requiredHostedWorkflows: DEFAULT_REQUIRED_HOSTED_WORKFLOWS,
    });
  });

  it('treats REPLACE_ME placeholders and malformed ids as unconfigured', () => {
    const result = resolveControlPlaneConfig(
      baseEnv({
        REPOSITORY_ID: 'REPLACE_ME_REPOSITORY_ID',
        LOCAL_CI_APP_ID: 'abc',
        GATE_WORKFLOW_ID: '0',
        FALLBACK_WORKFLOW_ID: '',
        SCHEDULED_VALIDATION_WORKFLOW_ID: undefined,
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing).toEqual([
      'REPOSITORY_ID',
      'LOCAL_CI_APP_ID',
      'GATE_WORKFLOW_ID',
      'FALLBACK_WORKFLOW_ID',
      'SCHEDULED_VALIDATION_WORKFLOW_ID',
    ]);
  });

  it('refuses any protected ref other than refs/heads/main', () => {
    const result = resolveControlPlaneConfig(baseEnv({ PROTECTED_REF: 'refs/heads/release' }));
    expect(result).toEqual({ ok: false, missing: ['PROTECTED_REF'] });
  });

  it('requires the three workflow ids to be distinct', () => {
    const result = resolveControlPlaneConfig(baseEnv({ FALLBACK_WORKFLOW_ID: GATE_WORKFLOW_ID }));
    expect(result).toEqual({ ok: false, missing: ['WORKFLOW_IDS_MUST_BE_DISTINCT'] });
  });

  it('parses an explicit required hosted workflow list and rejects malformed entries', () => {
    const custom = resolveControlPlaneConfig(
      baseEnv({
        REQUIRED_HOSTED_WORKFLOWS:
          ' .github/workflows/a.yml, .github/workflows/b.yaml,.github/workflows/a.yml ',
      }),
    );
    expect(custom.ok).toBe(true);
    if (custom.ok) {
      expect(custom.config.requiredHostedWorkflows).toEqual([
        '.github/workflows/a.yml',
        '.github/workflows/b.yaml',
      ]);
    }
    for (const value of ['workflows/a.yml', '.github/workflows/../x.yml', ',']) {
      const invalid = resolveControlPlaneConfig(baseEnv({ REQUIRED_HOSTED_WORKFLOWS: value }));
      expect(invalid).toEqual({ ok: false, missing: ['REQUIRED_HOSTED_WORKFLOWS'] });
    }
  });

  it('exposes a placeholder-aware configured-value guard', () => {
    expect(isConfiguredValue(undefined)).toBe(false);
    expect(isConfiguredValue('  ')).toBe(false);
    expect(isConfiguredValue('REPLACE_ME_TOKEN')).toBe(false);
    expect(isConfiguredValue('replace-me-evidence-bucket')).toBe(false);
    expect(isConfiguredValue('configured')).toBe(true);
  });
});
