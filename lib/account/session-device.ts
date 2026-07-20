export type AccountDeviceKind = 'desktop' | 'mobile' | 'tablet' | 'unknown';

export type AccountDevice = {
  kind: AccountDeviceKind;
  browser: string;
  operatingSystem: string;
  label: string;
};

function firstMatch(userAgent: string, pattern: RegExp): string | null {
  return userAgent.match(pattern)?.[1]?.replace(/_/g, '.') ?? null;
}

function detectOperatingSystem(userAgent: string): string {
  const iosVersion = firstMatch(userAgent, /(?:CPU (?:iPhone )?OS|iPhone OS) ([\d_]+)/i);
  if (/iPad/i.test(userAgent)) return iosVersion ? `iPadOS ${iosVersion}` : 'iPadOS';
  if (/iPhone|iPod/i.test(userAgent)) return iosVersion ? `iOS ${iosVersion}` : 'iOS';

  const androidVersion = firstMatch(userAgent, /Android ([\d.]+)/i);
  if (/Android/i.test(userAgent)) {
    return androidVersion ? `Android ${androidVersion}` : 'Android';
  }

  const windowsVersion = firstMatch(userAgent, /Windows NT ([\d.]+)/i);
  if (windowsVersion) {
    const friendlyWindowsVersions: Record<string, string> = {
      '10.0': 'Windows 10 or 11',
      '6.3': 'Windows 8.1',
      '6.2': 'Windows 8',
      '6.1': 'Windows 7',
    };
    return friendlyWindowsVersions[windowsVersion] ?? `Windows ${windowsVersion}`;
  }

  const macVersion = firstMatch(userAgent, /Mac OS X ([\d_]+)/i);
  if (macVersion) return `macOS ${macVersion}`;
  if (/CrOS/i.test(userAgent)) return 'ChromeOS';
  if (/Linux/i.test(userAgent)) return 'Linux';
  return 'Unknown OS';
}

function detectBrowser(userAgent: string): string {
  const edgeVersion = firstMatch(userAgent, /Edg(?:A|iOS)?\/([\d.]+)/i);
  if (edgeVersion) return `Edge ${edgeVersion.split('.')[0]}`;

  const operaVersion = firstMatch(userAgent, /(?:OPR|Opera)\/([\d.]+)/i);
  if (operaVersion) return `Opera ${operaVersion.split('.')[0]}`;

  const firefoxVersion = firstMatch(userAgent, /(?:Firefox|FxiOS)\/([\d.]+)/i);
  if (firefoxVersion) return `Firefox ${firefoxVersion.split('.')[0]}`;

  const chromeVersion = firstMatch(userAgent, /(?:Chrome|CriOS)\/([\d.]+)/i);
  if (chromeVersion) return `Chrome ${chromeVersion.split('.')[0]}`;

  const safariVersion = firstMatch(userAgent, /Version\/([\d.]+).*Safari/i);
  if (safariVersion) return `Safari ${safariVersion.split('.')[0]}`;

  return 'Unknown browser';
}

function detectKind(userAgent: string): AccountDeviceKind {
  if (/iPad|Tablet|PlayBook|Silk/i.test(userAgent)) return 'tablet';
  if (/Mobi|iPhone|iPod|Android/i.test(userAgent)) {
    return /Android/i.test(userAgent) && !/Mobi/i.test(userAgent) ? 'tablet' : 'mobile';
  }
  if (/Windows|Macintosh|CrOS|Linux/i.test(userAgent)) return 'desktop';
  return 'unknown';
}

export function describeAccountDevice(userAgent: string | null | undefined): AccountDevice {
  const normalized = userAgent?.trim() ?? '';
  if (!normalized) {
    return {
      kind: 'unknown',
      browser: 'Unknown browser',
      operatingSystem: 'Unknown OS',
      label: 'Unknown device',
    };
  }

  const browser = detectBrowser(normalized);
  const operatingSystem = detectOperatingSystem(normalized);
  const label =
    browser === 'Unknown browser' && operatingSystem === 'Unknown OS'
      ? 'Unknown device'
      : `${browser} on ${operatingSystem}`;

  return {
    kind: detectKind(normalized),
    browser,
    operatingSystem,
    label,
  };
}
