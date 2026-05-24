// server/index.js — NexMeet Signaling Server
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

// ── Firebase Admin (for plan verification) ───────────────────────────────────
// Install: npm install firebase-admin
// Set env: GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json
// OR set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
import admin from 'firebase-admin';

let adminApp = null;
try {
  adminApp = admin.initializeApp({
    credential: process.env.FIREBASE_PRIVATE_KEY
      ? admin.credential.cert({
          projectId:   process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey:  process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        })
      : admin.credential.applicationDefault(),
  });
  console.log('[NexMeet] Firebase Admin initialised ✅');
} catch (err) {
  console.warn('[NexMeet] Firebase Admin not configured — plan routes disabled:', err.message);
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],
});

// ── CORS for Express routes ───────────────────────────────────────────────────
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());

const MAX_PARTICIPANTS = 4;
const rooms = new Map();

// ── Auth middleware ───────────────────────────────────────────────────────────
// Verifies Firebase ID token passed as Bearer token in Authorization header.
async function verifyToken(req, res, next) {
  if (!adminApp) {
    return res.status(503).json({ error: 'Auth service unavailable' });
  }
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    req.decodedToken = await admin.auth().verifyIdToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ── Basic routes ──────────────────────────────────────────────────────────────
app.get('/', (_, res) => {
  res.json({
    status: '🚀 NexMeet Signaling Server is running',
    rooms: rooms.size,
    maxParticipantsPerRoom: MAX_PARTICIPANTS,
  });
});

app.get('/health', (_, res) => res.json({ status: 'ok', rooms: rooms.size }));

app.get('/create-room', (_, res) => {
  const roomId = uuidv4().slice(0, 8).toUpperCase();
  rooms.set(roomId, new Map());
  res.json({ roomId });
});

app.post('/create-room-with-id', (req, res) => {
  const { roomId } = req.body;
  if (!roomId) return res.status(400).json({ error: 'roomId required' });
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Map());
  }
  res.json({ roomId, created: true });
});

// ────────────────────────────────────────────────────────────────────────────
// AD SYSTEM ROUTES
// ────────────────────────────────────────────────────────────────────────────

/**
 * GET /ad-config
 * Returns ad configuration for the frontend.
 * No auth required — just returns public ad settings.
 *
 * Response:
 * {
 *   adsenseClient: string,   // your AdSense publisher ID
 *   adsenseSlot:   string,   // your AdSense ad slot ID
 *   videoAdTag:    string,   // your IMA VAST tag URL
 *   adDuration:    number,   // seconds before skip allowed
 *   adTotal:       number,   // total ad seconds
 * }
 */
app.get('/ad-config', (_, res) => {
  res.json({
    adsenseClient: process.env.ADSENSE_CLIENT || 'ca-pub-XXXXXXXXXXXXXXXX',
    adsenseSlot:   process.env.ADSENSE_SLOT   || 'XXXXXXXXXX',
    videoAdTag:    process.env.VIDEO_AD_TAG   ||
      'https://pubads.g.doubleclick.net/gampad/ads?' +
      'iu=/21775744923/external/single_ad_samples&sz=640x480' +
      '&cust_params=sample_ct%3Dlinear&ciu_szs=300x250%2C728x90' +
      '&gdfp_req=1&output=vast&unviewed_position_start=1&env=vp&impl=s&correlator=',
    adDuration: 30,     // skip allowed after this many seconds
    adTotal:    60,     // force-close after this many seconds
  });
});

/**
 * GET /user/plan
 * Returns the authenticated user's plan from Firestore.
 * Requires: Authorization: Bearer <firebase-id-token>
 *
 * Response: { plan: 'free' | 'pro' }
 */
app.get('/user/plan', verifyToken, async (req, res) => {
  try {
    const db   = admin.firestore();
    const snap = await db.collection('users').doc(req.decodedToken.uid).get();

    if (!snap.exists) {
      return res.json({ plan: 'free' });
    }
    res.json({ plan: snap.data().plan || 'free' });
  } catch (err) {
    console.error('[NexMeet] /user/plan error:', err);
    res.status(500).json({ error: 'Failed to read plan' });
  }
});

/**
 * POST /user/upgrade
 * Upgrades user to pro plan.
 * In production: integrate your payment provider (Stripe, Razorpay, etc.)
 * here BEFORE calling this. Only set plan='pro' after payment confirmation.
 *
 * Requires: Authorization: Bearer <firebase-id-token>
 * Body: { paymentToken: string }  ← from your payment provider
 *
 * Response: { success: true, plan: 'pro' }
 */
app.post('/user/upgrade', verifyToken, async (req, res) => {
  try {
    // ── PAYMENT VERIFICATION ─────────────────────────────────────────────
    // TODO: verify req.body.paymentToken with Stripe/Razorpay/etc. here
    // Example (Stripe):
    //   const session = await stripe.checkout.sessions.retrieve(req.body.sessionId)
    //   if (session.payment_status !== 'paid') return res.status(400).json({ error: 'Payment not confirmed' })
    // ────────────────────────────────────────────────────────────────────

    const db  = admin.firestore();
    const ref = db.collection('users').doc(req.decodedToken.uid);

    await ref.set({
      plan:       'pro',
      upgradedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log(`[NexMeet] User ${req.decodedToken.uid} upgraded to Pro`);
    res.json({ success: true, plan: 'pro' });
  } catch (err) {
    console.error('[NexMeet] /user/upgrade error:', err);
    res.status(500).json({ error: 'Upgrade failed' });
  }
});

/**
 * POST /user/downgrade
 * Reverts user to free plan (e.g. subscription cancelled).
 * Requires: Authorization: Bearer <firebase-id-token>
 */
app.post('/user/downgrade', verifyToken, async (req, res) => {
  try {
    const db  = admin.firestore();
    await db.collection('users').doc(req.decodedToken.uid).set({
      plan:         'free',
      downgradedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    res.json({ success: true, plan: 'free' });
  } catch (err) {
    console.error('[NexMeet] /user/downgrade error:', err);
    res.status(500).json({ error: 'Downgrade failed' });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// SOCKET.IO SIGNALING (unchanged from original)
// ────────────────────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[+] Socket connected: ${socket.id}`);

  socket.on('join-room', ({ roomId, displayName }) => {
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Map());
      console.log(`[Room ${roomId}] Auto-created on join.`);
    }

    const room = rooms.get(roomId);

    if (room.size >= MAX_PARTICIPANTS) {
      socket.emit('error', { code: 'ROOM_FULL', message: `This room is full (max ${MAX_PARTICIPANTS} participants).` });
      return;
    }

    const peerId = uuidv4();
    room.set(socket.id, { peerId, displayName: displayName || 'Guest', joinedAt: Date.now() });
    socket.join(roomId);
    socket.data.roomId      = roomId;
    socket.data.peerId      = peerId;
    socket.data.displayName = displayName || 'Guest';

    const existingPeers = [];
    room.forEach((info, sid) => {
      if (sid !== socket.id) {
        existingPeers.push({ socketId: sid, peerId: info.peerId, displayName: info.displayName });
      }
    });

    socket.emit('room-joined', { roomId, peerId, existingPeers, participantCount: room.size });
    socket.to(roomId).emit('peer-joined', { socketId: socket.id, peerId, displayName: socket.data.displayName });
    console.log(`[Room ${roomId}] ${displayName} joined. Participants: ${room.size}`);
  });

  socket.on('offer',         ({ to, offer })     => io.to(to).emit('offer',         { from: socket.id, peerId: socket.data.peerId, displayName: socket.data.displayName, offer }));
  socket.on('answer',        ({ to, answer })    => io.to(to).emit('answer',        { from: socket.id, answer }));
  socket.on('ice-candidate', ({ to, candidate }) => io.to(to).emit('ice-candidate', { from: socket.id, candidate }));

  socket.on('media-state', ({ video, audio }) => {
    const roomId = socket.data.roomId;
    if (roomId) socket.to(roomId).emit('peer-media-state', { socketId: socket.id, video, audio });
  });

  socket.on('screen-share-started', () => {
    const roomId = socket.data.roomId;
    if (roomId) socket.to(roomId).emit('peer-screen-share', { socketId: socket.id, sharing: true });
  });

  socket.on('screen-share-stopped', () => {
    const roomId = socket.data.roomId;
    if (roomId) socket.to(roomId).emit('peer-screen-share', { socketId: socket.id, sharing: false });
  });

  socket.on('chat-message', ({ message }) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    io.to(roomId).emit('chat-message', {
      from: socket.id,
      displayName: socket.data.displayName,
      message,
      timestamp: Date.now(),
    });
  });

  socket.on('raise-hand', ({ raised }) => {
    const roomId = socket.data.roomId;
    if (roomId) socket.to(roomId).emit('peer-raise-hand', { socketId: socket.id, raised });
  });

  socket.on('reaction', ({ emoji }) => {
    const roomId = socket.data.roomId;
    if (roomId) io.to(roomId).emit('peer-reaction', { socketId: socket.id, displayName: socket.data.displayName, emoji });
  });

  socket.on('disconnect', () => {
    const { roomId, displayName } = socket.data;
    if (roomId && rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.delete(socket.id);
      socket.to(roomId).emit('peer-left', { socketId: socket.id });
      console.log(`[Room ${roomId}] ${displayName} left. Remaining: ${room.size}`);
      if (room.size === 0) {
        rooms.delete(roomId);
        console.log(`[Room ${roomId}] Closed (empty)`);
      }
    }
  });
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`\n🚀 NexMeet Signaling Server running on http://localhost:${PORT}\n`);
});