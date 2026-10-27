import { describe, expect, it } from "vitest";
import { CustomError, type ErrorInit } from "@/core/errors/customError";
import { ErrorType } from "@/core/errors/errorTypes";

type CustomErrorCtor = new (
  message: string,
  options?: ErrorInit,
) => CustomError;

export interface CustomErrorSpec {
  ErrorClass: CustomErrorCtor;
  statusCode: number;
  defaultType: ErrorType;
  isOperational: boolean;
}

export function describeCustomError(spec: CustomErrorSpec) {
  const { ErrorClass, statusCode, defaultType, isOperational } = spec;

  describe(ErrorClass.name, () => {
    it("is an Error and a CustomError", () => {
      const err = new ErrorClass("boom");
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(CustomError);
      expect(err).toBeInstanceOf(ErrorClass);
    });

    it(`has status code ${statusCode}`, () => {
      expect(new ErrorClass("boom").statusCode).toBe(statusCode);
    });

    it(`defaults the code to "${defaultType}"`, () => {
      expect(new ErrorClass("boom").code).toBe(defaultType);
    });

    it(`has isOperational=${isOperational}`, () => {
      expect(new ErrorClass("boom").isOperational).toBe(isOperational);
    });

    it("uses the class name as the error name", () => {
      expect(new ErrorClass("boom").name).toBe(ErrorClass.name);
    });

    it("allows overriding the error type", () => {
      const err = new ErrorClass("boom", { type: ErrorType.TOKEN_INVALID });
      expect(err.code).toBe(ErrorType.TOKEN_INVALID);
    });

    it("serializes to a response body using the message", () => {
      expect(new ErrorClass("boom").toResponse()).toEqual({
        error: defaultType,
        message: "boom",
      });
    });

    it("prefers the client message in the response body", () => {
      const err = new ErrorClass("internal detail", {
        clientMessage: "safe message",
      });
      expect(err.message).toBe("internal detail");
      expect(err.toResponse()).toEqual({
        error: defaultType,
        message: "safe message",
      });
    });

    it("preserves the cause", () => {
      const cause = new Error("root");
      expect(new ErrorClass("boom", { cause }).cause).toBe(cause);
    });
  });
}
