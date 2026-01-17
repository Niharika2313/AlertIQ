import dotenv from "dotenv";
dotenv.config();

import express from "express";
import User from "../models/User.js";
import Session from "../models/Session.js";
import twilio from "twilio";
import crypto from "crypto";

const router = express.Router();

const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH);

// Generate unique session ID
function generateSessionId() {
  return `sos_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
}

// Trigger SOS - Create session and send SMS with tracking link
router.post("/trigger", async (req, res) => {
  console.log("🚨 SOS API HIT");

  const { uid, location } = req.body;

  try {
    const user = await User.findOne({ uid });

    console.log("👤 User:", user?.name);

    if (!user) {
      console.log("❌ User not found");
      return res.status(404).json({ error: "User not found" });
    }

    // Validate emergency contacts exist
    if (!user.emergencyContacts || user.emergencyContacts.length === 0) {
      return res.status(400).json({
        error: "No emergency contacts configured for this user",
      });
    }

    // Validate Twilio configuration
    if (!process.env.TWILIO_PHONE) {
      console.error("❌ TWILIO_PHONE not configured in environment variables");
      return res.status(500).json({
        error: "SMS service not configured",
      });
    }

    // Ensure Twilio phone has + prefix
    const twilioPhone = process.env.TWILIO_PHONE.startsWith("+")
      ? process.env.TWILIO_PHONE
      : `+${process.env.TWILIO_PHONE}`;

    console.log("📞 Twilio Phone:", twilioPhone);

    // Create tracking session in MongoDB
    const sessionId = generateSessionId();
    const session = await Session.create({
      sessionId,
      uid,
      userName: user.name || "User",
      userPhone: user.phone,
      locations: [
        {
          lat: location.lat,
          lng: location.lng,
          timestamp: new Date(),
        },
      ],
      activeViewers: 0,
      ended: false,
    });

    console.log("✅ Session created:", sessionId);

    // Generate tracking link
    const trackingUrl = `${process.env.WEB_URL || "http://localhost:3000"}/track/${sessionId}`;

    console.log("🔗 Tracking URL:", trackingUrl);

    // Shorter message to stay under trial account's 4-segment limit
    const message = `🚨 EMERGENCY from ${user.name || "User"}!

Track location: ${trackingUrl}`;

    const results = [];

    console.log(
      `📨 Sending SMS to ${user.emergencyContacts.length} contacts...`,
    );

    for (const contact of user.emergencyContacts) {
      try {
        // Ensure contact phone has + prefix
        const contactPhone = contact.phone.startsWith("+")
          ? contact.phone
          : `+${contact.phone}`;

        console.log(`📤 Sending to ${contact.name} (${contactPhone})...`);

        const messageResult = await client.messages.create({
          body: message,
          from: twilioPhone,
          to: contactPhone,
        });

        console.log(`✅ SMS sent successfully. SID: ${messageResult.sid}`);
        console.log(`   Status: ${messageResult.status}`);

        results.push({
          name: contact.name,
          phone: contactPhone,
          status: "sent",
          sid: messageResult.sid,
          twilioStatus: messageResult.status,
        });
      } catch (err) {
        console.error(`❌ SMS Error for ${contact.name}:`, err.message);
        results.push({
          name: contact.name,
          phone: contact.phone,
          status: "failed",
          error: err.message,
        });
      }
    }

    // Log summary
    const successCount = results.filter((r) => r.status === "sent").length;
    console.log(
      `📊 SMS Summary: ${successCount}/${results.length} sent successfully`,
    );

    res.json({
      success: true,
      sessionId,
      results,
      summary: {
        total: results.length,
        sent: successCount,
        failed: results.length - successCount,
      },
    });
  } catch (err) {
    console.error("💥 SOS trigger error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update location (only processed if viewers are active)
router.post("/update-location", async (req, res) => {
  const { sessionId, location, timestamp } = req.body;

  try {
    const session = await Session.findOne({ sessionId });

    if (!session) {
      console.log("❌ Session not found:", sessionId);
      return res.status(404).json({ error: "Session not found" });
    }

    if (session.ended) {
      return res.json({ success: false, message: "Session already ended" });
    }

    // Only store location if someone is actively viewing
    if (session.activeViewers > 0) {
      session.locations.push({
        lat: location.lat,
        lng: location.lng,
        timestamp: timestamp || new Date(),
      });

      // Keep only last 100 locations to save memory
      if (session.locations.length > 100) {
        session.locations = session.locations.slice(-100);
      }

      await session.save();

      console.log(
        `📍 Location updated for session ${sessionId}. Active viewers: ${session.activeViewers}`,
      );
    }

    res.json({
      success: true,
      viewersActive: session.activeViewers > 0,
      message:
        session.activeViewers > 0
          ? "Location stored"
          : "No active viewers, location not stored",
    });
  } catch (err) {
    console.error("💥 Location update error:", err);
    res.status(500).json({ error: err.message });
  }
});

// End session
router.post("/end-session", async (req, res) => {
  const { sessionId } = req.body;

  try {
    const session = await Session.findOne({ sessionId });

    if (session) {
      session.ended = true;
      session.endedAt = new Date();
      await session.save();
      console.log(`🛑 Session ${sessionId} ended by user`);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("💥 End session error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get session data (for tracking website)
router.get("/session/:sessionId", async (req, res) => {
  const { sessionId } = req.params;

  console.log("🔍 Looking for session:", sessionId);

  try {
    const session = await Session.findOne({ sessionId });

    if (!session) {
      console.log("❌ Session not found!");
      const allSessions = await Session.find({}).select("sessionId createdAt");
      console.log(
        "📋 Available sessions:",
        allSessions.map((s) => s.sessionId),
      );
      return res.status(404).json({ error: "Session not found or expired" });
    }

    console.log("✅ Session found:", session.userName);
    console.log("📊 Locations:", session.locations.length);
    console.log("👥 Active viewers:", session.activeViewers);

    res.json({
      userName: session.userName,
      locations: session.locations,
      ended: session.ended,
      createdAt: session.createdAt,
      endedAt: session.endedAt || null,
    });
  } catch (err) {
    console.error("💥 Get session error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Server-Sent Events endpoint for live updates
router.get("/stream/:sessionId", async (req, res) => {
  const { sessionId } = req.params;

  try {
    const session = await Session.findOne({ sessionId });

    if (!session) {
      console.log("❌ Stream: Session not found:", sessionId);
      return res.status(404).json({ error: "Session not found" });
    }

    // Set up Server-Sent Events
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");

    // Increment active viewers
    session.activeViewers++;
    await session.save();

    console.log(
      `👁️ Viewer connected to session ${sessionId}. Active viewers: ${session.activeViewers}`,
    );

    // Send initial data
    res.write(
      `data: ${JSON.stringify({
        type: "init",
        session: {
          userName: session.userName,
          locations: session.locations,
          ended: session.ended,
          createdAt: session.createdAt,
        },
      })}\n\n`,
    );

    let lastLocationIndex = session.locations.length;

    // Send updates every 2 seconds
    const interval = setInterval(async () => {
      try {
        const currentSession = await Session.findOne({ sessionId });

        if (!currentSession) {
          clearInterval(interval);
          res.end();
          return;
        }

        // Check for new locations
        if (currentSession.locations.length > lastLocationIndex) {
          const newLocations =
            currentSession.locations.slice(lastLocationIndex);
          newLocations.forEach((location) => {
            res.write(
              `data: ${JSON.stringify({ type: "update", location })}\n\n`,
            );
          });
          lastLocationIndex = currentSession.locations.length;
        }

        // Check if session ended
        if (currentSession.ended) {
          res.write(
            `data: ${JSON.stringify({ type: "ended", endedAt: currentSession.endedAt })}\n\n`,
          );
          clearInterval(interval);
          res.end();
        }
      } catch (err) {
        console.error("💥 Stream interval error:", err);
        clearInterval(interval);
        res.end();
      }
    }, 2000);

    // Clean up on disconnect
    req.on("close", async () => {
      clearInterval(interval);
      try {
        const currentSession = await Session.findOne({ sessionId });
        if (currentSession) {
          currentSession.activeViewers = Math.max(
            0,
            currentSession.activeViewers - 1,
          );
          await currentSession.save();
          console.log(
            `👋 Viewer disconnected from session ${sessionId}. Active viewers: ${currentSession.activeViewers}`,
          );
        }
      } catch (err) {
        console.error("💥 Disconnect cleanup error:", err);
      }
    });
  } catch (err) {
    console.error("💥 Stream setup error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
