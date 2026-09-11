import { expect, it } from "vitest";
import {
  errorDetails,
  OperationError,
  StorageConfigurationError,
} from "../../src/server/diagnostics";

it("reports storage failure codes and request metadata without raw secrets", () => {
  const error = Object.assign(
    new Error("secret-token https://signed.example/?credential=secret"),
    {
      name: "AccessDenied",
      code: "AccessDenied",
      $metadata: {
        httpStatusCode: 403,
        requestId: "storage-request-123",
        attempts: 1,
      },
      authorization: "Bearer secret-token",
      body: "private draft",
    },
  );
  const details = errorDetails(new OperationError("storage.putObject", error));
  expect(details).toMatchObject({
    operation: "storage.putObject",
    cause: {
      name: "AccessDenied",
      code: "AccessDenied",
      httpStatus: 403,
      storageRequestId: "storage-request-123",
      attempts: 1,
    },
  });
  expect(JSON.stringify(details)).not.toMatch(/secret|private|signed/);
});
it("identifies missing configuration and bounded nested network causes", () => {
  expect(
    errorDetails(new StorageConfigurationError(["S3_BUCKET"])),
  ).toMatchObject({ missingVariables: ["S3_BUCKET"] });
  const error = Object.assign(new Error("connection failed"), {
    code: "ENOTFOUND",
  });
  expect(
    errorDetails(new Error("SDK failure", { cause: error })),
  ).toMatchObject({ cause: { code: "ENOTFOUND" } });
  Object.assign(error, { cause: error });
  expect(() => JSON.stringify(errorDetails(error))).not.toThrow();
});
