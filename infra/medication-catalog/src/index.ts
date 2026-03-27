import express, { Request, Response, NextFunction } from "express";

// --- Medication model ---

interface Medication {
  id: string;
  name: string;
  amount: number;
  currency: string;
  stock_total: number;
  stock_reserved: number;
  requires_cold_chain: boolean;
}

// --- Seed data ---

function createSeedData(): Medication[] {
  return [
    {
      id: "MED-001",
      name: "Amoxicillin 500mg",
      amount: 12.5,
      currency: "USD",
      stock_total: 15,
      stock_reserved: 3,
      requires_cold_chain: false,
    },
    {
      id: "MED-002",
      name: "Lisinopril 10mg",
      amount: 8.75,
      currency: "USD",
      stock_total: 20,
      stock_reserved: 5,
      requires_cold_chain: false,
    },
    {
      id: "MED-003",
      name: "Metformin 850mg",
      amount: 6.3,
      currency: "USD",
      stock_total: 30,
      stock_reserved: 10,
      requires_cold_chain: false,
    },
    {
      id: "MED-004",
      name: "Omeprazole 20mg",
      amount: 15.0,
      currency: "USD",
      stock_total: 8,
      stock_reserved: 7,
      requires_cold_chain: false,
    },
    {
      id: "MED-005",
      name: "Insulin Glargine 100U/mL",
      amount: 45.0,
      currency: "USD",
      stock_total: 10,
      stock_reserved: 2,
      requires_cold_chain: true,
    },
  ];
}

let medications: Medication[] = createSeedData();

// --- Helpers ---

function findMedication(id: string): Medication | undefined {
  return medications.find((m) => m.id === id);
}

// --- Realistic simulation middleware ---

function chaosMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip chaos for health and reset endpoints
  if (req.path === "/health" || req.path === "/medications/reset") {
    next();
    return;
  }

  // ~20% chance of 503
  if (Math.random() < 0.2) {
    res.status(503).json({
      error: "service_unavailable",
      message: "Service temporarily unavailable",
    });
    return;
  }

  // ~15% chance of added latency (2-4 seconds)
  if (Math.random() < 0.15) {
    const delay = 2000 + Math.random() * 2000;
    setTimeout(() => next(), delay);
    return;
  }

  next();
}

// --- App setup ---

const app = express();
app.use(express.json());
app.use(chaosMiddleware);

// --- Routes ---

// Health check
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// List all medications
app.get("/medications", (_req: Request, res: Response) => {
  res.json(medications);
});

// Get a single medication
app.get("/medications/:id", (req: Request, res: Response) => {
  const med = findMedication(req.params.id);
  if (!med) {
    res.status(404).json({
      error: "medication_not_found",
      message: `Medication ${req.params.id} not found`,
    });
    return;
  }
  res.json(med);
});

// Reserve stock
app.post("/medications/:id/reserve", (req: Request, res: Response) => {
  const med = findMedication(req.params.id);
  if (!med) {
    res.status(404).json({
      error: "medication_not_found",
      message: `Medication ${req.params.id} not found`,
    });
    return;
  }

  const quantity = req.body?.quantity;
  if (typeof quantity !== "number" || quantity <= 0) {
    res.status(400).json({
      error: "invalid_quantity",
      message: "quantity must be a positive number",
    });
    return;
  }

  const available = med.stock_total - med.stock_reserved;
  if (available < quantity) {
    res.status(409).json({
      error: "insufficient_stock",
      message: `Cannot reserve ${quantity} units. Available: ${available}`,
      available,
    });
    return;
  }

  med.stock_reserved += quantity;
  res.json({
    id: med.id,
    stock_total: med.stock_total,
    stock_reserved: med.stock_reserved,
    reserved_quantity: quantity,
  });
});

// Release reserved stock
app.post("/medications/:id/release", (req: Request, res: Response) => {
  const med = findMedication(req.params.id);
  if (!med) {
    res.status(404).json({
      error: "medication_not_found",
      message: `Medication ${req.params.id} not found`,
    });
    return;
  }

  const quantity = req.body?.quantity;
  if (typeof quantity !== "number" || quantity <= 0) {
    res.status(400).json({
      error: "invalid_quantity",
      message: "quantity must be a positive number",
    });
    return;
  }

  med.stock_reserved = Math.max(0, med.stock_reserved - quantity);
  res.json({
    id: med.id,
    stock_total: med.stock_total,
    stock_reserved: med.stock_reserved,
    released_quantity: quantity,
  });
});

// Reset all stock to initial values
app.post("/medications/reset", (_req: Request, res: Response) => {
  medications = createSeedData();
  res.json({ status: "reset", medications });
});

// --- Start server ---

const PORT = 3050;
app.listen(PORT, () => {
  console.log(`Medication Catalog API running on port ${PORT}`);
});
