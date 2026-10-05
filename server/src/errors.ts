/** Application error carrying an HTTP status and a short machine-readable code. */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail?: unknown;

  constructor(message: string, status = 500, code = "INTERNAL_ERROR", detail?: unknown) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

export const badRequest = (message: string, code = "BAD_REQUEST", detail?: unknown): AppError =>
  new AppError(message, 400, code, detail);

export const notFound = (message: string, code = "NOT_FOUND", detail?: unknown): AppError =>
  new AppError(message, 404, code, detail);