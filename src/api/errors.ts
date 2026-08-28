export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isAuth(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isRateLimited(): boolean {
    return this.status === 429;
  }
}

export class NetworkError extends Error {
  constructor(cause?: unknown) {
    super('Brak polaczenia z siecia');
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

/** Komunikat do pokazania uzytkownikowi - bez stack trace i surowego JSON-a. */
export function describeError(error: unknown): string {
  if (error instanceof NetworkError) return error.message;
  if (error instanceof ApiError) {
    if (error.isAuth) return 'Sesja wygasla - zaloguj sie ponownie.';
    if (error.isForbidden) return 'Brak uprawnien do tego zasobu.';
    if (error.isRateLimited) return 'Za duzo zapytan do Twitcha - sprobuj za chwile.';
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Nieznany blad';
}
