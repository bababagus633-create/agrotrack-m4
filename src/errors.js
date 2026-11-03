export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// Kesalahan tingkat repositori (dipetakan oleh service menjadi AppError)
export class RepoError extends Error {
  constructor(kind) {
    super(kind);
    this.kind = kind; // DUP_CODE | DUP_CLIENT_ID | DUP_SEQ
  }
}
