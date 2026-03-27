import express, { Request, Response } from "express";

const app = express();
app.use(express.json());

const PORT = 3060;

// --- Types ---

interface Subscription {
  topic: string;
  callback_url: string;
}

interface Message {
  id: string;
  topic: string;
  message: unknown;
  timestamp: string;
  deliveries: DeliveryStatus[];
}

interface DeliveryStatus {
  callback_url: string;
  status: "pending" | "delivered" | "failed";
  attempts: number;
}

// --- State ---

const subscriptions: Subscription[] = [];
const messages: Message[] = [];
let messageCounter = 0;

// --- Helpers ---

function generateId(): string {
  messageCounter++;
  return `msg-${Date.now()}-${messageCounter}`;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function deliverToSubscriber(
  topic: string,
  payload: unknown,
  callbackUrl: string,
  delivery: DeliveryStatus
): Promise<void> {
  const maxRetries = 3;
  const backoffDelays = [1000, 2000, 4000];

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    delivery.attempts = attempt;
    try {
      const response = await fetch(callbackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, message: payload }),
      });

      if (response.ok) {
        delivery.status = "delivered";
        console.log(
          `[broker] Delivered to ${callbackUrl} (topic: ${topic}, attempt: ${attempt})`
        );
        return;
      }

      console.warn(
        `[broker] Non-2xx from ${callbackUrl}: ${response.status} (attempt ${attempt}/${maxRetries})`
      );
    } catch (err) {
      console.warn(
        `[broker] Delivery error to ${callbackUrl} (attempt ${attempt}/${maxRetries}):`,
        (err as Error).message
      );
    }

    if (attempt < maxRetries) {
      await sleep(backoffDelays[attempt - 1]);
    }
  }

  delivery.status = "failed";
  console.error(
    `[broker] Failed to deliver to ${callbackUrl} after ${maxRetries} attempts`
  );
}

async function publishToSubscribers(msg: Message): Promise<void> {
  const topicSubscribers = subscriptions.filter((s) => s.topic === msg.topic);

  if (topicSubscribers.length === 0) {
    console.log(`[broker] No subscribers for topic: ${msg.topic}`);
    return;
  }

  const deliveryPromises = topicSubscribers.map((sub) => {
    const delivery: DeliveryStatus = {
      callback_url: sub.callback_url,
      status: "pending",
      attempts: 0,
    };
    msg.deliveries.push(delivery);
    return deliverToSubscriber(msg.topic, msg.message, sub.callback_url, delivery);
  });

  // Fire and forget -- deliveries happen in the background
  Promise.all(deliveryPromises).catch((err) => {
    console.error("[broker] Unexpected delivery error:", err);
  });
}

// --- Routes ---

app.post("/publish", (req: Request, res: Response) => {
  const { topic, message } = req.body;

  if (!topic || message === undefined) {
    res.status(400).json({ error: "Missing required fields: topic, message" });
    return;
  }

  const msg: Message = {
    id: generateId(),
    topic,
    message,
    timestamp: new Date().toISOString(),
    deliveries: [],
  };

  messages.push(msg);
  publishToSubscribers(msg);

  console.log(`[broker] Published message ${msg.id} to topic: ${topic}`);
  res.status(200).json({ id: msg.id, topic, status: "published" });
});

app.post("/subscribe", (req: Request, res: Response) => {
  const { topic, callback_url } = req.body;

  if (!topic || !callback_url) {
    res
      .status(400)
      .json({ error: "Missing required fields: topic, callback_url" });
    return;
  }

  const existing = subscriptions.find(
    (s) => s.topic === topic && s.callback_url === callback_url
  );

  if (existing) {
    res.status(200).json({ status: "already_subscribed", topic, callback_url });
    return;
  }

  subscriptions.push({ topic, callback_url });
  console.log(`[broker] Subscribed ${callback_url} to topic: ${topic}`);
  res.status(200).json({ status: "subscribed", topic, callback_url });
});

app.get("/messages", (_req: Request, res: Response) => {
  res.status(200).json(messages);
});

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", uptime: process.uptime() });
});

// --- Start ---

app.listen(PORT, () => {
  console.log(`[broker] Message broker listening on port ${PORT}`);
});
