const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");

//  Firebase setup
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const app = express();

app.use(cors());
app.use(express.json());

//  Test route
app.get("/", (req, res) => {
  res.send("Server is running 🚀");
});


// ======================= BOOKINGS APIs =======================

//  CREATE booking (WITH SEAT REDUCTION)
app.post("/bookings", async (req, res) => {
  try {
    const { userId, eventId, seatsBooked } = req.body;

    if (!userId || !eventId || !seatsBooked) {
      return res.status(400).json({
        error: "userId, eventId and seatsBooked are required"
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
        error: "Not enough seats available"
      });
    }

    await eventRef.update({
      availableSeats: eventData.availableSeats - seatsBooked
    });

    const newBooking = {
      userId,
      eventId,
      seatsBooked,
      createdAt: new Date()
    };

    const docRef = await db.collection("bookings").add(newBooking);

    res.status(201).json({
      message: "Booking created successfully",
      bookingId: docRef.id
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// READ all bookings
app.get("/bookings", async (req, res) => {
  try {
    const snapshot = await db.collection("bookings").get();

    const bookings = [];

    snapshot.forEach(doc => {
      bookings.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.status(200).json(bookings);

  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// NEW: GET bookings by user (QUERY)
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
    res.status(500).json({ error: "Error fetching bookings" });
  }
});


// NEW: GET bookings by event (QUERY)
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
    res.status(500).json({ error: "Error fetching bookings" });
  }
});


//  UPDATE booking
app.put("/bookings/:id", async (req, res) => {
  try {
    const bookingId = req.params.id;
    const { seatsBooked } = req.body;

    const bookingRef = db.collection("bookings").doc(bookingId);
    const bookingDoc = await bookingRef.get();

    const oldBooking = bookingDoc.data();

    const eventRef = db.collection("events").doc(oldBooking.eventId);
    const eventDoc = await eventRef.get();
    const eventData = eventDoc.data();

    const difference = seatsBooked - oldBooking.seatsBooked;

    if (eventData.availableSeats < difference) {
      return res.status(400).json({
        error: "Not enough seats available"
      });
    }

    await eventRef.update({
      availableSeats: eventData.availableSeats - difference
    });

    await bookingRef.update({ seatsBooked });

    res.json({ message: "Booking updated successfully" });

  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});


//  DELETE booking
app.delete("/bookings/:id", async (req, res) => {
  try {
    const bookingRef = db.collection("bookings").doc(req.params.id);
    const bookingDoc = await bookingRef.get();

    const bookingData = bookingDoc.data();

    const eventRef = db.collection("events").doc(bookingData.eventId);
    const eventDoc = await eventRef.get();

    await eventRef.update({
      availableSeats: eventDoc.data().availableSeats + bookingData.seatsBooked
    });

    await bookingRef.delete();

    res.json({ message: "Booking deleted and seats restored" });

  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// ======================= EVENTS APIs =======================

//  READ events
app.get("/events", async (req, res) => {
  try {
    const snapshot = await db.collection("events").get();

    const events = [];
    snapshot.forEach(doc => {
      events.push({ id: doc.id, ...doc.data() });
    });

    res.json(events);

  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});


//  NEW: GET events with available seats (QUERY)
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
    res.status(500).json({ error: "Error fetching events" });
  }
});


// ======================= USERS =======================

//  CREATE user
app.post("/users", async (req, res) => {
  try {
    const { name, email } = req.body;

    const docRef = await db.collection("users").add({ name, email });

    res.status(201).json({
      message: "User created",
      userId: docRef.id
    });

  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// ======================= START SERVER =======================

const PORT = 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});