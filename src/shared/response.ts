export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiFailure {
  success: false;
  error: {
    code: number;
    name: string;
    message: string;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export function success<T>(data: T): ApiSuccess<T> {
  return {
    success: true,
    data
  };
}

export function failure(code: number, name: string, message: string): ApiFailure {
  return {
    success: false,
    error: {
      code,
      name,
      message
    }
  };
}
