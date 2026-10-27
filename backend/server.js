import app from "./app.js";
import { checkConnections } from "./config/connections.js";
import "dotenv/config";

const PORT = process.env.PORT || 5000;

// Start HTTP Server and verify connections
const server = app.listen(PORT, async () => {
  console.log(`\n========================================`);
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
  await checkConnections();
  console.log(`========================================\n`);
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
