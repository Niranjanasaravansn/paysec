exports.asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
exports.errorHandler = (e, req, res, _next) => {
  const status = e.status || 500;
  if (status === 500) console.error(e);
  res.status(status).json({ success: false, error: status === 500 ? 'Internal server error' : e.message });
};
