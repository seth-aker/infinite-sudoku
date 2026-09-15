import { ErrorType } from "./errorTypes";

export interface ErrorInit extends ErrorOptions {
  type?: ErrorType;
  clientMessage?: string;
}

export abstract class CustomError extends Error {
  abstract readonly statusCode: number;
  protected abstract readonly defaultType: ErrorType;

  readonly isOperational: boolean = true;
  private readonly typeOverride?: ErrorType;
  readonly clientMessage?: string;

  constructor(message: string, options?: ErrorInit) {
    super(message, options);
    this.name = new.target.name;
    this.typeOverride = options?.type;
    this.clientMessage = options?.clientMessage;
    Error.captureStackTrace?.(this, new.target);
  }

  get code(): ErrorType {
    return this.typeOverride ?? this.defaultType;
  }

  toResponse(): Record<string, unknown> {
    return { error: this.code, message: this.clientMessage ?? this.message };
  }
}
