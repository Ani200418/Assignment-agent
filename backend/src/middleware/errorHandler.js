// Every response uses one of two shapes so the frontend can rely on them:
//   success: { success: true,  data: ... }
//   failure: { success: false, error: { code, message, details? } }

class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Route not found: ${req.method} ${req.originalUrl}` },
  });
}

// Express recognises error handlers by their 4 arguments - keep all four.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Body that is not valid JSON (thrown by express.json()).
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON.' },
    });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large.' },
    });
  }
  // Services may throw lightweight errors with status/code; normalize them here.
  if (err instanceof HttpError || (Number.isInteger(err.status) && err.status >= 400 && err.status < 600)) {
    const error = { code: err.code || 'REQUEST_ERROR', message: err.message || 'Request could not be completed.' };
    if (err.details) error.details = err.details;
    return res.status(err.status).json({ success: false, error });
  }

  // Unknown error: log it for us, but do not leak internals to the client.
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on the server.' },
  });
}

module.exports = { HttpError, notFoundHandler, errorHandler };
