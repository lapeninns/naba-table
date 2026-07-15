const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateOpenApiDocument(document: unknown): string[] {
  const issues: string[] = [];
  if (!isRecord(document)) {
    return ['OpenAPI document must be an object.'];
  }

  if (typeof document.openapi !== 'string' || !document.openapi.startsWith('3.')) {
    issues.push('openapi must declare a supported 3.x version.');
  }
  const info = isRecord(document.info) ? document.info : {};
  if (typeof info.title !== 'string' || info.title.trim().length === 0) {
    issues.push('info.title is required.');
  }
  if (typeof info.version !== 'string' || info.version.trim().length === 0) {
    issues.push('info.version is required.');
  }

  const paths = isRecord(document.paths) ? document.paths : {};
  if (Object.keys(paths).length === 0) {
    issues.push('paths must document at least one endpoint.');
  }

  for (const [route, pathItemValue] of Object.entries(paths)) {
    if (!isRecord(pathItemValue)) continue;
    for (const method of HTTP_METHODS) {
      const operation = pathItemValue[method];
      if (!isRecord(operation)) continue;
      if (!isRecord(operation.responses) || Object.keys(operation.responses).length === 0) {
        issues.push(`${method.toUpperCase()} ${route} must document responses.`);
      }
    }
  }

  return issues;
}
