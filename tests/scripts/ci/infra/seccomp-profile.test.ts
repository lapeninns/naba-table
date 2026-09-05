import { describe, expect, it } from 'vitest';

import { readInfraFile } from './helpers';

type SyscallRule = {
  readonly names: readonly string[];
  readonly action: string;
  readonly errnoRet?: number;
  readonly args?: readonly { index: number; value: number; valueTwo: number; op: string }[];
};

type SeccompProfile = {
  readonly defaultAction: string;
  readonly defaultErrnoRet: number;
  readonly archMap: readonly { architecture: string }[];
  readonly syscalls: readonly SyscallRule[];
};

const profile = JSON.parse(readInfraFile('seccomp/ci-job.json')) as SeccompProfile;

const requiredDenies = [
  'ptrace',
  'process_vm_readv',
  'process_vm_writev',
  'kcmp',
  'pidfd_getfd',
  'mount',
  'umount2',
  'move_mount',
  'open_tree',
  'fsopen',
  'fsmount',
  'pivot_root',
  'chroot',
  'keyctl',
  'add_key',
  'request_key',
  'bpf',
  'unshare',
  'setns',
  'personality',
  'io_uring_setup',
  'io_uring_enter',
  'io_uring_register',
  'userfaultfd',
  'perf_event_open',
  'init_module',
  'finit_module',
  'reboot',
  'kexec_load',
  'swapon',
  'settimeofday',
  'clock_settime',
];

const requiredAllows = [
  'read',
  'write',
  'openat',
  'execve',
  'mmap',
  'futex',
  'epoll_pwait',
  'getrandom',
  'memfd_create',
  'clone',
  'rt_sigaction',
  'prctl',
  'seccomp',
  'socket',
];

describe('infra/local-ci/seccomp/ci-job.json', () => {
  const allowRules = profile.syscalls.filter((rule) => rule.action === 'SCMP_ACT_ALLOW');
  const denyRules = profile.syscalls.filter((rule) => rule.action === 'SCMP_ACT_ERRNO');
  const allowed = new Set(allowRules.flatMap((rule) => rule.names));
  const denied = new Set(denyRules.flatMap((rule) => rule.names));

  it('fails closed by default and covers arm64 and x86_64', () => {
    expect(profile.defaultAction).toBe('SCMP_ACT_ERRNO');
    expect(profile.defaultErrnoRet).toBe(1);
    const architectures = profile.archMap.map((entry) => entry.architecture);
    expect(architectures).toContain('SCMP_ARCH_AARCH64');
    expect(architectures).toContain('SCMP_ARCH_X86_64');
  });

  it('lists every required extra deny explicitly', () => {
    for (const name of requiredDenies) {
      expect(denied.has(name), `${name} must be explicitly denied`).toBe(true);
    }
  });

  it('never allows a denied syscall (no overlap between allow and deny lists)', () => {
    const overlap = [...denied].filter((name) => allowed.has(name));
    expect(overlap).toEqual([]);
  });

  it('keeps the syscalls a Node/Chromium job needs', () => {
    for (const name of requiredAllows) {
      expect(allowed.has(name), `${name} must be allowed`).toBe(true);
    }
  });

  it('masks namespace flags on clone and forces clone3 to fall back', () => {
    const clone = allowRules.find((rule) => rule.names.includes('clone'));
    expect(clone?.args).toEqual([
      { index: 0, value: 2114060288, valueTwo: 0, op: 'SCMP_CMP_MASKED_EQ' },
    ]);
    const clone3 = denyRules.find((rule) => rule.names.includes('clone3'));
    expect(clone3?.errnoRet).toBe(38);
  });

  it('only allows socket() for non-vsock families', () => {
    const socket = allowRules.find((rule) => rule.names.includes('socket'));
    expect(socket?.args).toEqual([{ index: 0, value: 40, valueTwo: 0, op: 'SCMP_CMP_NE' }]);
    // The socket rule is the only allow entry for "socket".
    expect(allowRules.filter((rule) => rule.names.includes('socket'))).toHaveLength(1);
  });

  it('has no duplicate names inside the plain allow list', () => {
    const plain = allowRules.find((rule) => rule.args === undefined);
    expect(plain).toBeDefined();
    const names = plain?.names ?? [];
    expect(new Set(names).size).toBe(names.length);
  });
});
