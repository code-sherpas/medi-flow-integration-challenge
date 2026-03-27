import express from "express";
import { config } from "./config";

const app = express();
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "prescription-service" });
});

// TODO: Implement your routes here
// - POST /prescriptions
// - GET /prescriptions/:id
// - GET /prescriptions

app.listen(config.port, () => {
  console.log(`Prescription Service running on port ${config.port}`);

  // TODO: Subscribe to authorization.results topic via the message broker
});
