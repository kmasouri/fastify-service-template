export const ERROR_DEFINITIONS = {
  internalError: {
    code: 1000,
    name: 'internal_error',
    statusCode: 500
  },
  validationError: {
    code: 1400,
    name: 'validation_error',
    statusCode: 400
  },
  notFound: {
    code: 1404,
    name: 'not_found',
    statusCode: 404
  },
  conflict: {
    code: 1409,
    name: 'conflict',
    statusCode: 409
  }
} as const;

type ErrorDefinition = (typeof ERROR_DEFINITIONS)[keyof typeof ERROR_DEFINITIONS];

export class AppError extends Error {
  constructor(message: string, definition: ErrorDefinition = ERROR_DEFINITIONS.internalError) {
    super(message);
    this.statusCode = definition.statusCode;
    this.code = definition.code;
    this.name = definition.name;
  }

  public readonly statusCode: number;
  public readonly code: number;
  public override readonly name: string;
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, ERROR_DEFINITIONS.notFound);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, ERROR_DEFINITIONS.conflict);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, ERROR_DEFINITIONS.validationError);
  }
}
