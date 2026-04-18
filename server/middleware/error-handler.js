export function notFoundHandler(_req, res) {
  res.status(404).json({ message: "Route not found." });
}

export function errorHandler(error, _req, res, _next) {
  console.error(error);

  let statusCode = error.statusCode || 500;
  let message = error.message || "Request failed.";

  if (error.code === "LIMIT_FILE_SIZE") {
    statusCode = 400;
    message = "Image must be 5 MB or smaller.";
  } else if (message.includes("Only JPEG, PNG, WEBP, and GIF images are allowed")) {
    statusCode = 400;
  } else if (message === "CORS origin not allowed") {
    statusCode = 403;
  }

  if (statusCode >= 500) {
    message = "Internal server error.";
  }

  res.status(statusCode).json({ message });
}
