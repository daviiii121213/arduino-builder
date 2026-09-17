/** Erro de aplicação com status HTTP e código legível para o cliente. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, string>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const badRequest = (message: string, details?: Record<string, string>) =>
  new ApiError(400, 'validation_error', message, details);

export const notFound = (message: string) => new ApiError(404, 'not_found', message);

export const conflict = (message: string) => new ApiError(409, 'conflict', message);

export const unauthorized = (message: string) => new ApiError(401, 'unauthorized', message);
