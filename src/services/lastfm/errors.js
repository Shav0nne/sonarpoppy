export class LastfmApiError extends Error {
  constructor(message, statusCode = null) {
    super(message);
    this.name = "LastfmApiError";
    this.statusCode = statusCode;
  }
}

export class LastfmRateLimitError extends LastfmApiError {
  constructor(message = "Rate limit exceeded") {
    super(message, 429);
    this.name = "LastfmRateLimitError";
  }
}

export class LastfmNotFoundError extends LastfmApiError {
  constructor(message = "Resource not found") {
    super(message, 404);
    this.name = "LastfmNotFoundError";
  }
}
