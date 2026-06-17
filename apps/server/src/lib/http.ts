import type { Request, Response, NextFunction, RequestHandler } from "express";

// Wraps an async route handler so thrown/rejected errors reach the error middleware.
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

// Express 5 types route params as `string | string[]` (array for wildcard routes).
// Our routes only use single-value named params, so coerce to a plain string.
export function param(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

// Reads a single-value query param as a string, or undefined when absent.
export function queryString(req: Request, name: string): string | undefined {
  const value = req.query[name];
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

// A typed error carrying an HTTP status code.
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
