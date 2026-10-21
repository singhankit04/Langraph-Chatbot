import app from "./index.js";
import "dotenv/config";

const PORT = process.env.PORT || 5000;

// Start HTTP Server
const server = app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

// Graceful Shutdown
process.on("SIGINT", () => {
  console.log("\nReceived SIGINT. Shutting down gracefully...");
  server.close(() => {
    console.log("Server closed.");
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  console.log("\nReceived SIGTERM. Shutting down gracefully...");
  server.close(() => {
    console.log("Server closed.");
    process.exit(0);
  });
});
