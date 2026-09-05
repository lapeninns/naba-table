#!/usr/bin/env bash
# Installed root-owned outside the Actions runner directory, before registration.
set -euo pipefail
python3 - <<'PY'
import json, os, sys
from pathlib import Path
try:
    expected = json.loads(Path('/etc/nabatable-ci/actions-proof.json').read_text())
    event = json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text())
    checks = (
        os.environ.get('GITHUB_EVENT_NAME') == 'push',
        os.environ.get('GITHUB_REPOSITORY_ID') == str(expected['repositoryId']),
        os.environ.get('GITHUB_ACTOR_ID') == str(expected['actorId']),
        os.environ.get('GITHUB_SHA') == expected['sha'],
        os.environ.get('GITHUB_WORKFLOW_REF') == expected['workflowRef'],
        event.get('repository', {}).get('id') == expected['repositoryId'],
        event.get('repository', {}).get('fork') is False,
        event.get('after') == expected['sha'],
        event.get('deleted') is False,
    )
    if not all(checks): raise ValueError('untrusted job')
except Exception:
    print('Actions proof admission refused: job identity mismatch', file=sys.stderr)
    sys.exit(1)
print('Actions proof admission accepted')
PY
