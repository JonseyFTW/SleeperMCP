export class JsonRpcError extends Error {
  code: number;
  data?: any;

  constructor(code: number, message: string, data?: any) {
    super(message);
    this.name = 'JsonRpcError';
    this.code = code;
    this.data = data;
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      data: this.data,
    };
  }
}

// Standard JSON-RPC error codes
export const ErrorCodes = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,

  // Custom error codes
  RATE_LIMIT_EXCEEDED: -32003,
  SERVICE_UNAVAILABLE: -32002,
  RESOURCE_NOT_FOUND: -32001,
} as const;

export class ValidationError extends JsonRpcError {
  constructor(message: string, details?: any) {
    super(ErrorCodes.INVALID_PARAMS, message, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends JsonRpcError {
  constructor(resource: string) {
    super(ErrorCodes.RESOURCE_NOT_FOUND, `${resource} not found`);
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends JsonRpcError {
  constructor(retryAfter?: number) {
    super(
      ErrorCodes.RATE_LIMIT_EXCEEDED,
      'Rate limit exceeded',
      retryAfter ? { retryAfter } : undefined
    );
    this.name = 'RateLimitError';
  }
}

export class ServiceUnavailableError extends JsonRpcError {
  constructor(service: string) {
    super(ErrorCodes.SERVICE_UNAVAILABLE, `${service} service unavailable`);
    this.name = 'ServiceUnavailableError';
  }
}
