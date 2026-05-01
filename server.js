const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const path = require("path");

// ========== FIREBASE SETUP ==========
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const app = express();

// ========== MIDDLEWARE ==========
app.use(cors());
app.use(express.json());

// Simple request logger - useful for Jenkins console output during demo
app.use((req, res, next) => {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${req.method} ${req.path}`);
  next();
});

// Serve index.html and static frontend at root
app.use(express.static(path.join(__dirname)));

// ========== HEALTH CHECK ==========
// Used by Jenkins after restart to verify deployment success
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "Eventory API",
    version: "1.2.0",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()) + "s"
  });
});

// Root - friendly status message (also a quick deployment check)
app.get("/api", (req, res) => {
  res.json({
    message: "Eventory API is running",
    endpoints: [
      "GET  /events",
      "GET  /events/available",
      "GET  /bookings",
      "POST /bookings",
      "PUT  /bookings/:id",
      "DELETE /bookings/:id",
      "GET  /bookings/user/:userId",
      "GET  /bookings/event/:eventId",
      "POST /users",
      "GET  /health"
    ]
  });
});


// ========== BOOKINGS APIs ==========

// CREATE booking (with seat reduction)
app.post("/bookings", async (req, res) => {
  try {
    const { userId, eventId, seatsBooked } = req.body;

    if (!userId || !eventId || !seatsBooked) {
      return res.status(400).json({
        error: "userId, eventId and seatsBooked are required"
      });
    }

    if (Number(seatsBooked) < 1) {
      return res.status(400).json({
        error: "seatsBooked must be at least 1"
      });
    }

    const eventRef = db.collection("events").doc(eventId);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) {
      return res.status(404).json({ error: "Event not found" });
    }

    const eventData = eventDoc.data();

    if (eventData.availableSeats < seatsBooked) {
      return res.status(400).json({
        error: `Only ${eventData.availableSeats} seats available`
      });
    }

    await eventRef.update({
      availableSeats: eventData.availableSeats - seatsBooked
    });

    const newBooking = {
      userId,
      eventId,
      seatsBooked: Number(seatsBooked),
      createdAt: new Date()
    };

    const docRef = await db.collection("bookings").add(newBooking);

    console.log(`✅ Booking created: ${docRef.id} (${seatsBooked} seats for event ${eventId})`);

    res.status(201).json({
      message: "Booking created successfully",
      bookingId: docRef.id
    });

  } catch (error) {
    console.error("❌ Booking creation error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// READ all bookings
app.get("/bookings", async (req, res) => {
  try {
    const snapshot = await db.collection("bookings").get();
    const bookings = [];
    snapshot.forEach(doc => {
      bookings.push({ id: doc.id, ...doc.data() });
    });
    res.status(200).json(bookings);
  } catch (error) {
    console.error("❌ Error fetching bookings:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// GET bookings by user
app.get("/bookings/user/:userId", async (req, res) => {
  try {
    const snapshot = await db
      .collection("bookings")
      .where("userId", "==", req.params.userId)
      .get();

    const data = [];
    snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
    res.status(200).json(data);
  } catch (error) {
    console.error("❌ Error fetching user bookings:", error);
    res.status(500).json({ error: "Error fetching bookings" });
  }
});


// GET bookings by event
app.get("/bookings/event/:eventId", async (req, res) => {
  try {
    const snapshot = await db
      .collection("bookings")
      .where("eventId", "==", req.params.eventId)
      .get();

    const data = [];
    snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
    res.status(200).json(data);
  } catch (error) {
    console.error("❌ Error fetching event bookings:", error);
    res.status(500).json({ error: "Error fetching bookings" });
  }
});


// UPDATE booking
app.put("/bookings/:id", async (req, res) => {
  try {
    const bookingId = req.params.id;
    const { seatsBooked } = req.body;

    if (!seatsBooked || Number(seatsBooked) < 1) {
      return res.status(400).json({
        error: "Valid seatsBooked is required (minimum 1)"
      });
    }

    const bookingRef = db.collection("bookings").doc(bookingId);
    const bookingDoc = await bookingRef.get();

    if (!bookingDoc.exists) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const oldBooking = bookingDoc.data();

    const eventRef = db.collection("events").doc(oldBooking.eventId);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) {
      return res.status(404).json({ error: "Associated event not found" });
    }

    const eventData = eventDoc.data();
    const difference = Number(seatsBooked) - oldBooking.seatsBooked;

    if (eventData.availableSeats < difference) {
      return res.status(400).json({
        error: `Only ${eventData.availableSeats} additional seats available`
      });
    }

    await eventRef.update({
      availableSeats: eventData.availableSeats - difference
    });

    await bookingRef.update({ seatsBooked: Number(seatsBooked) });

    console.log(`✅ Booking ${bookingId} updated to ${seatsBooked} seats`);

    res.json({ message: "Booking updated successfully" });

  } catch (error) {
    console.error("❌ Update error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// DELETE booking
app.delete("/bookings/:id", async (req, res) => {
  try {
    const bookingRef = db.collection("bookings").doc(req.params.id);
    const bookingDoc = await bookingRef.get();

    if (!bookingDoc.exists) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const bookingData = bookingDoc.data();

    const eventRef = db.collection("events").doc(bookingData.eventId);
    const eventDoc = await eventRef.get();

    if (eventDoc.exists) {
      await eventRef.update({
        availableSeats: eventDoc.data().availableSeats + bookingData.seatsBooked
      });
    }

    await bookingRef.delete();

    console.log(`✅ Booking ${req.params.id} deleted, ${bookingData.seatsBooked} seats restored`);

    res.json({ message: "Booking deleted and seats restored" });

  } catch (error) {
    console.error("❌ Delete error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// ========== EVENTS APIs ==========

// READ all events
app.get("/events", async (req, res) => {
  try {
    const snapshot = await db.collection("events").get();
    const events = [];
    snapshot.forEach(doc => {
      events.push({ id: doc.id, ...doc.data() });
    });
    res.json(events);
  } catch (error) {
    console.error("❌ Error fetching events:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// GET events with available seats
app.get("/events/available", async (req, res) => {
  try {
    const snapshot = await db
      .collection("events")
      .where("availableSeats", ">", 0)
      .get();

    const data = [];
    snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
    res.json(data);
  } catch (error) {
    console.error("❌ Error fetching available events:", error);
    res.status(500).json({ error: "Error fetching events" });
  }
});


// ========== USERS APIs ==========

// CREATE user
app.post("/users", async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: "name and email are required" });
    }

    const docRef = await db.collection("users").add({ name, email, createdAt: new Date() });

    console.log(`✅ User created: ${docRef.id}`);

    res.status(201).json({
      message: "User created",
      userId: docRef.id
    });

  } catch (error) {
    console.error("❌ User creation error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// READ all users
app.get("/users", async (req, res) => {
  try {
    const snapshot = await db.collection("users").get();
    const users = [];
    snapshot.forEach(doc => users.push({ id: doc.id, ...doc.data() }));
    res.json(users);
  } catch (error) {
    console.error("❌ Error fetching users:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// ========== ERROR HANDLER ==========
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});


// ========== START SERVER ==========
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log("=".repeat(50));
  console.log(`🚀 Eventory API server running on port ${PORT}`);
  console.log(`📅 Started at: ${new Date().toISOString()}`);
  console.log(`🌐 Frontend:   http://localhost:${PORT}/`);
  console.log(`🔌 API base:   http://localhost:${PORT}/api`);
  console.log(`💚 Health:     http://localhost:${PORT}/health`);
  console.log("=".repeat(50));
});


// Graceful shutdown — important for Jenkins to cleanly restart the app
const shutdown = (signal) => {
  console.log(`\n📛 ${signal} received. Shutting down gracefully...`);
  server.close(() => {
    console.log("✅ Server closed cleanly");
    process.exit(0);
  });

  // Force-exit after 10s if still running
  setTimeout(() => {
    console.error("⚠ Forced shutdown");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));