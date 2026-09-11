export class OperationError extends Error {
  constructor(
    public operation: string,
    cause: unknown,
  ) {
    super(operation, { cause });
    this.name = "OperationError";
  }
}
export class StorageConfigurationError extends Error {
  constructor(public missingVariables: string[]) {
    super("Screenshot storage is not configured");
    this.name = "StorageConfigurationError";
  }
}
// Deliberately omit raw messages, stacks, SQL, request headers and SDK request objects:
// these can include credentials, signed URLs, or draft content.
export function errorDetails(
  error: unknown,
  depth = 0,
): Record<string, unknown> {
  if (!error || typeof error !== "object" || depth > 3) return {};
  const value = error as Record<string, unknown>;
  const identifier = (v: unknown) =>
    typeof v === "string" && /^[\w.-]{1,100}$/.test(v) ? v : undefined;
  const metadata = value.$metadata as Record<string, unknown> | undefined;
  return {
    name: identifier(value.name),
    code: identifier(value.code),
    operation: error instanceof OperationError ? error.operation : undefined,
    missingVariables:
      error instanceof StorageConfigurationError
        ? error.missingVariables
        : undefined,
    httpStatus:
      typeof metadata?.httpStatusCode === "number"
        ? metadata.httpStatusCode
        : undefined,
    storageRequestId: identifier(metadata?.requestId),
    attempts:
      typeof metadata?.attempts === "number" ? metadata.attempts : undefined,
    cause: value.cause ? errorDetails(value.cause, depth + 1) : undefined,
  };
}
