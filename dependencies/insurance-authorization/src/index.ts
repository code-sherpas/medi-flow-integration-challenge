import express, { Request, Response } from "express";
import crypto from "crypto";

const PORT = 3070;
const MESSAGE_BROKER_URL =
  process.env.MESSAGE_BROKER_URL || "http://message-broker:3060";
const CALLBACK_URL =
  process.env.CALLBACK_URL || "http://insurance-authorization:3070/webhook";

const app = express();
app.use(express.json());

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "insurance-authorization" });
});

// ---------------------------------------------------------------------------
// Webhook – receives messages from the broker
// ---------------------------------------------------------------------------
interface AuthorizationRequest {
  prescription_id: string;
  patient_id: string;
  total_amount: number;
  currency: string;
  items: { medication_id: string; quantity: number; unit_amount: number }[];
}

interface WebhookBody {
  topic: string;
  message: AuthorizationRequest;
}

app.post("/webhook", (req: Request, res: Response) => {
  const body: WebhookBody = req.body;
  const { message } = body;

  console.log(
    `[webhook] Received authorization request for prescription ${message.prescription_id}`
  );

  // Acknowledge receipt immediately
  res.status(200).json({ received: true });

  // Process asynchronously with a 1-3 second delay
  const delay = 1000 + Math.random() * 2000;
  setTimeout(() => processRequest(message), delay);
});

// ---------------------------------------------------------------------------
// Process an authorization request and publish the result
// ---------------------------------------------------------------------------
async function processRequest(request: AuthorizationRequest): Promise<void> {
  const approved = Math.random() < 0.8;
  const result = {
    prescription_id: request.prescription_id,
    status: approved ? "approved" : "rejected",
    authorization_code: approved
      ? `AUTH-${crypto.randomBytes(6).toString("hex")}`
      : null,
    timestamp: new Date().toISOString(),
  };

  console.log(
    `[process] Prescription ${result.prescription_id} -> ${result.status}`
  );

  try {
    const response = await fetch(`${MESSAGE_BROKER_URL}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: "authorization.results",
        message: result,
      }),
    });

    if (!response.ok) {
      console.error(
        `[process] Failed to publish result: ${response.status} ${response.statusText}`
      );
    } else {
      console.log(
        `[process] Published result for ${result.prescription_id} to authorization.results`
      );
    }
  } catch (err) {
    console.error(`[process] Error publishing result:`, err);
  }
}

// ---------------------------------------------------------------------------
// Subscribe to the broker with exponential backoff
// ---------------------------------------------------------------------------
async function subscribeWithRetry(
  maxRetries = 10,
  baseDelay = 1000
): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(
        `[subscribe] Attempting to subscribe (attempt ${attempt}/${maxRetries})...`
      );

      const response = await fetch(`${MESSAGE_BROKER_URL}/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: "authorization.requests",
          callback_url: CALLBACK_URL,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      console.log(
        `[subscribe] Successfully subscribed to authorization.requests`
      );
      return;
    } catch (err) {
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.error(
        `[subscribe] Attempt ${attempt} failed: ${err}. Retrying in ${delay}ms...`
      );

      if (attempt === maxRetries) {
        console.error(
          `[subscribe] All ${maxRetries} attempts exhausted. Will continue running but may miss messages.`
        );
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`[server] Insurance Authorization service listening on port ${PORT}`);
  subscribeWithRetry();
});
