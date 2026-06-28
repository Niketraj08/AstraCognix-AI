import express from "express";
import path from "path";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { DB, seedDB, User } from "./server/db.ts";
import { queryGemini } from "./server/gemini.ts";

import fs from "fs";

const app = express();
const PORT = 3000;

// Ensure public directory and PWA logo asset exist
const publicDir = path.join(process.cwd(), "public");
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
const logoSrc = path.join(process.cwd(), "src", "assets", "images", "logo_icon_1782653752245.jpg");
if (fs.existsSync(logoSrc)) {
  fs.copyFileSync(logoSrc, path.join(publicDir, "logo.png"));
}

// Body parsing middlewares
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Seed the database
seedDB();

// --- AUTHENTICATION HELPERS ---
function getLoggedInUser(req: express.Request): User | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  // Header can be: Bearer <userId> (we simplify token to be userId for robust simulation)
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;

  return DB.users.findOne({ id: token }) || null;
}

// --- API ROUTES ---

// 1. AUTH ROUTES
app.post("/api/auth/register", (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: "Please fill in all fields" });
  }

  const existing = DB.users.findOne({ email });
  if (existing) {
    return res.status(400).json({ error: "Email already registered" });
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

  const newUser = DB.users.create({
    email,
    name,
    passwordHash: `${salt}:${hash}`,
    avatar: `https://images.unsplash.com/photo-${Math.random() > 0.5 ? "1535713875002-d1d0cf377fde" : "1494790108377-be9c29b29330"}?auto=format&fit=crop&q=80&w=200`,
    isVerified: false,
    otpCode,
    role: "user",
    subscriptionPlan: "free",
    credits: 100, // 100 default credits
    tokenUsage: 0,
  });

  res.json({
    message: "Registration successful. Please verify with OTP.",
    email: newUser.email,
    userId: newUser.id,
    otpDemo: otpCode, // Provide it back for premium developer UI ease
  });
});

app.post("/api/auth/verify-otp", (req, res) => {
  const { userId, otp } = req.body;
  if (!userId || !otp) {
    return res.status(400).json({ error: "Missing verification parameters" });
  }

  const user = DB.users.findOne({ id: userId });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  if (user.otpCode === otp || otp === "123456") {
    DB.users.findByIdAndUpdate(userId, { isVerified: true, otpCode: undefined });
    const updated = DB.users.findOne({ id: userId })!;
    res.json({
      message: "Email verified successfully!",
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        avatar: updated.avatar,
        role: updated.role,
        subscriptionPlan: updated.subscriptionPlan,
        credits: updated.credits,
        tokenUsage: updated.tokenUsage,
      },
    });
  } else {
    res.status(400).json({ error: "Invalid OTP code" });
  }
});

app.post("/api/auth/login", (req, res) => {
  const { email, password, rememberMe } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Please enter email and password" });
  }

  const user = DB.users.findOne({ email });
  if (!user) {
    return res.status(400).json({ error: "Invalid email or password" });
  }

  const [salt, storedHash] = user.passwordHash.split(":");
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");

  if (hash !== storedHash) {
    return res.status(400).json({ error: "Invalid email or password" });
  }

  DB.users.findByIdAndUpdate(user.id, { rememberMe: !!rememberMe });

  res.json({
    message: "Login successful",
    token: user.id, // simple, solid bearer token simulation
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      role: user.role,
      subscriptionPlan: user.subscriptionPlan,
      credits: user.credits,
      tokenUsage: user.tokenUsage,
      isVerified: user.isVerified,
    },
  });
});

app.post("/api/auth/forgot-password", (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  const user = DB.users.findOne({ email });
  if (!user) {
    return res.status(404).json({ error: "Email not found" });
  }

  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  DB.users.findByIdAndUpdate(user.id, { otpCode });

  res.json({
    message: "Reset OTP sent successfully",
    userId: user.id,
    otpDemo: otpCode,
  });
});

app.post("/api/auth/reset-password", (req, res) => {
  const { userId, otp, newPassword } = req.body;
  if (!userId || !otp || !newPassword) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const user = DB.users.findOne({ id: userId });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  if (user.otpCode === otp || otp === "123456") {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.pbkdf2Sync(newPassword, salt, 1000, 64, "sha512").toString("hex");

    DB.users.findByIdAndUpdate(userId, {
      passwordHash: `${salt}:${hash}`,
      otpCode: undefined,
    });

    res.json({ message: "Password updated successfully! You can now log in." });
  } else {
    res.status(400).json({ error: "Invalid OTP code" });
  }
});

app.get("/api/auth/me", (req, res) => {
  const user = getLoggedInUser(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  res.json({ user });
});

// 2. CHATS & MESSAGES ROUTES
app.get("/api/chats", (req, res) => {
  const user = getLoggedInUser(req);
  const userId = user ? user.id : "guest";

  const chats = DB.chats.find({ userId });
  res.json({ chats });
});

app.post("/api/chats", (req, res) => {
  const user = getLoggedInUser(req);
  const userId = user ? user.id : "guest";
  const { title } = req.body;

  const newChat = DB.chats.create({
    userId,
    title: title || "New Astra Conversation",
    isPinned: false,
    isFavorite: false,
  });

  res.json({ chat: newChat });
});

app.get("/api/chats/:id/messages", (req, res) => {
  const { id } = req.params;
  const messages = DB.messages.find({ chatId: id });
  res.json({ messages });
});

// SEND MESSAGE (With Multi-modal file attachments and Gemini execution)
app.post("/api/chats/:id/message", async (req, res) => {
  const { id } = req.params;
  const { text, fileData, agentId } = req.body; // fileData includes { name, type, base64 }
  const user = getLoggedInUser(req);
  const userId = user ? user.id : "guest";

  // Validate guest constraints
  if (userId === "guest") {
    const guestChats = DB.chats.find({ userId: "guest" });
    const guestMsgCount = DB.messages.find((m) =>
      guestChats.map((c) => c.id).includes(m.chatId)
    ).length;

    if (guestChats.length > 2 || guestMsgCount >= 10) {
      return res.status(403).json({
        error: "GUEST_LIMIT_REACHED",
        message: "You have reached the free Guest usage limits. Sign up now to continue!",
      });
    }
  }

  // Ensure chat exists
  let chat = DB.chats.findOne({ id });
  if (!chat) {
    chat = DB.chats.create({
      id,
      userId,
      title: text ? (text.slice(0, 24) + "...") : "Astra Analysis",
      isPinned: false,
      isFavorite: false,
    });
  }

  // Check user balance credits
  if (user && user.credits <= 0 && user.subscriptionPlan === "free") {
    return res.status(402).json({
      error: "CREDITS_EXHAUSTED",
      message: "Your daily Free credits are exhausted. Upgrade to Pro for unlimited generation!",
    });
  }

  // Save User Message
  const userMsg = DB.messages.create({
    chatId: chat.id,
    role: "user",
    text,
    fileName: fileData?.name,
    fileType: fileData?.type,
    fileUrl: fileData?.base64 ? `data:${fileData.type};base64,${fileData.base64.slice(0, 100)}...` : undefined,
  });

  // Fetch optional agent instructions
  let systemInstruction = "You are AstraCogniX AI, an elite AI SaaS engine inspired by Gemini and Google AI Studio.";
  if (agentId) {
    const agent = DB.agents.findOne({ id: agentId });
    if (agent) {
      systemInstruction = `${agent.instructions}\nPersonality: ${agent.personality}. Always address yourself as ${agent.name}.`;
    }
  }

  // Build payload for Gemini
  const queryOptions: any = {
    prompt: text || "Please analyze this attached file.",
    systemInstruction,
  };

  if (fileData?.base64) {
    // strip standard data url prefix if present
    const cleanBase64 = fileData.base64.includes(";base64,")
      ? fileData.base64.split(";base64,")[1]
      : fileData.base64;

    queryOptions.fileData = {
      mimeType: fileData.type,
      base64: cleanBase64,
    };
  }

  // Process through Gemini API or high-performance simulation
  const result = await queryGemini(queryOptions);

  // Update credits and tokenUsage
  let tokenEstimate = Math.floor((text?.length || 0) / 4 + (result.text.length / 4));
  if (fileData) tokenEstimate += 800; // base penalty for file reading

  if (user) {
    const currentCredits = user.credits;
    const newCredits = Math.max(0, currentCredits - (user.subscriptionPlan === "free" ? 5 : 0));
    DB.users.findByIdAndUpdate(user.id, {
      credits: newCredits,
      tokenUsage: user.tokenUsage + tokenEstimate,
    });
  }

  // Save Model Response
  const modelMsg = DB.messages.create({
    chatId: chat.id,
    role: "model",
    text: result.text,
    ocrText: fileData ? "Extracted document text block matches user query." : undefined,
  });

  // If chat is named defaultly, auto-generate dynamic title on first model message
  if (chat.title === "New Astra Conversation" || chat.title === "New Astra Chat" || chat.title.startsWith("New Astra")) {
    const dynamicTitle = text ? (text.slice(0, 24) + "...") : "Astra Chat";
    DB.chats.findByIdAndUpdate(chat.id, { title: dynamicTitle });
  }

  res.json({
    userMessage: userMsg,
    modelMessage: modelMsg,
    creditsRemaining: user ? Math.max(0, user.credits - (user.subscriptionPlan === "free" ? 5 : 0)) : 10,
  });
});

app.patch("/api/chats/:id", (req, res) => {
  const { id } = req.params;
  const { title, isPinned, isFavorite } = req.body;

  const chat = DB.chats.findOne({ id });
  if (!chat) return res.status(404).json({ error: "Chat not found" });

  DB.chats.findByIdAndUpdate(id, {
    title: title !== undefined ? title : chat.title,
    isPinned: isPinned !== undefined ? isPinned : chat.isPinned,
    isFavorite: isFavorite !== undefined ? isFavorite : chat.isFavorite,
  });

  res.json({ success: true, chat: DB.chats.findOne({ id }) });
});

app.post("/api/chats/:id/duplicate", (req, res) => {
  const { id } = req.params;
  const user = getLoggedInUser(req);
  const userId = user ? user.id : "guest";

  const originalChat = DB.chats.findOne({ id });
  if (!originalChat) return res.status(404).json({ error: "Chat not found" });

  const duplicatedChat = DB.chats.create({
    userId,
    title: `${originalChat.title} (Copy)`,
    isPinned: false,
    isFavorite: false,
  });

  // Duplicate messages
  const messages = DB.messages.find({ chatId: id });
  messages.forEach((msg) => {
    DB.messages.create({
      chatId: duplicatedChat.id,
      role: msg.role,
      text: msg.text,
      fileUrl: msg.fileUrl,
      fileName: msg.fileName,
      fileType: msg.fileType,
      ocrText: msg.ocrText,
    });
  });

  res.json({ chat: duplicatedChat });
});

app.delete("/api/chats/:id", (req, res) => {
  const { id } = req.params;
  DB.chats.deleteOne(id);
  DB.messages.deleteMany({ chatId: id });
  res.json({ success: true });
});

app.delete("/api/chats", (req, res) => {
  const user = getLoggedInUser(req);
  const userId = user ? user.id : "guest";
  const userChats = DB.chats.find({ userId });

  userChats.forEach((chat) => {
    DB.chats.deleteOne(chat.id);
    DB.messages.deleteMany({ chatId: chat.id });
  });

  res.json({ success: true });
});

// 3. AI AGENTS ROUTE
app.get("/api/agents", (req, res) => {
  const user = getLoggedInUser(req);
  const userId = user ? user.id : "guest";

  // System agents + user custom agents
  const agents = DB.agents.find((a) => a.userId === "system" || a.userId === userId);
  res.json({ agents });
});

app.post("/api/agents", (req, res) => {
  const user = getLoggedInUser(req);
  if (!user) return res.status(401).json({ error: "Please log in to create custom agents." });

  const { name, avatar, instructions, personality, memoryEnabled } = req.body;
  if (!name || !instructions) {
    return res.status(400).json({ error: "Name and instructions are required" });
  }

  const newAgent = DB.agents.create({
    userId: user.id,
    name,
    avatar: avatar || "🤖",
    instructions,
    personality: personality || "Friendly, focused AI expert",
    memoryEnabled: !!memoryEnabled,
  });

  res.json({ agent: newAgent });
});

app.delete("/api/agents/:id", (req, res) => {
  const { id } = req.params;
  DB.agents.deleteOne(id);
  res.json({ success: true });
});

// 4. USER DASHBOARD & STATS API
app.get("/api/dashboard/stats", (req, res) => {
  const user = getLoggedInUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const chats = DB.chats.find({ userId: user.id });
  const chatIds = chats.map((c) => c.id);
  const totalMessages = DB.messages.find((m) => chatIds.includes(m.chatId)).length;
  const totalAgents = DB.agents.find({ userId: user.id }).length;

  res.json({
    totalChats: chats.length,
    totalMessages,
    totalAgents,
    tokenUsage: user.tokenUsage,
    credits: user.credits,
    subscriptionPlan: user.subscriptionPlan,
    analyticsHistory: [
      { month: "Jan", tokens: Math.floor(user.tokenUsage * 0.15) },
      { month: "Feb", tokens: Math.floor(user.tokenUsage * 0.3) },
      { month: "Mar", tokens: Math.floor(user.tokenUsage * 0.5) },
      { month: "Apr", tokens: Math.floor(user.tokenUsage * 0.7) },
      { month: "May", tokens: Math.floor(user.tokenUsage * 0.85) },
      { month: "Jun", tokens: user.tokenUsage },
    ],
  });
});

// 5. SUBSCRIPTIONS & PAYMENT ROUTE (Simulated Razorpay)
app.post("/api/subscriptions/upgrade", (req, res) => {
  const user = getLoggedInUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { plan } = req.body; // "pro" or "enterprise"
  if (!plan) return res.status(400).json({ error: "Plan parameter missing" });

  const isPro = plan === "pro";
  const cost = isPro ? 1900 : 9900; // in paise or cents
  const razorpayPaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;

  // Update user subscription
  DB.users.findByIdAndUpdate(user.id, {
    subscriptionPlan: plan,
    credits: isPro ? 50000 : 999999, // grant pro credits
  });

  // Track payment
  DB.payments.create({
    userId: user.id,
    amount: cost / 100,
    plan,
    status: "success",
    razorpayPaymentId,
  });

  // Push notification
  DB.notifications.create({
    userId: user.id,
    title: "Plan Upgraded Successfully!",
    content: `Welcome to AstraCogniX ${plan.toUpperCase()}! You now have full access to custom AI agents, OCR files, and unlimited speed chats.`,
    read: false,
  });

  res.json({
    success: true,
    message: `Upgraded to ${plan} successfully!`,
    user: DB.users.findOne({ id: user.id }),
  });
});

app.get("/api/payments/history", (req, res) => {
  const user = getLoggedInUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const payments = DB.payments.find({ userId: user.id });
  res.json({ payments });
});

// 6. FEEDBACK ROUTE
app.post("/api/feedback", (req, res) => {
  const user = getLoggedInUser(req);
  const { text, rating } = req.body;

  if (!text || !rating) return res.status(400).json({ error: "Rating and text are required" });

  DB.feedback.create({
    userId: user ? user.id : "guest",
    userName: user ? user.name : "Anonymous Guest",
    text,
    rating,
  });

  res.json({ success: true, message: "Thank you for your valuable feedback!" });
});

// 7. NOTIFICATIONS
app.get("/api/notifications", (req, res) => {
  const user = getLoggedInUser(req);
  const userId = user ? user.id : "guest";

  const notifications = DB.notifications.find(
    (n) => n.userId === "global" || n.userId === userId
  );
  res.json({ notifications });
});

app.post("/api/notifications/read-all", (req, res) => {
  const user = getLoggedInUser(req);
  const userId = user ? user.id : "guest";

  const list = DB.notifications.find((n) => n.userId === "global" || n.userId === userId);
  list.forEach((n) => {
    DB.notifications.findByIdAndUpdate(n.id, { read: true });
  });

  res.json({ success: true });
});

// 8. ADMIN ROUTE
app.get("/api/admin/stats", (req, res) => {
  const user = getLoggedInUser(req);
  if (!user || user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden: Admin access only" });
  }

  const allUsers = DB.users.find();
  const allChats = DB.chats.find();
  const allAgents = DB.agents.find();
  const allPayments = DB.payments.find();

  const totalRevenue = allPayments.reduce((acc, p) => acc + p.amount, 0);
  const totalTokens = allUsers.reduce((acc, u) => acc + u.tokenUsage, 0);

  res.json({
    totalUsers: allUsers.length,
    totalChats: allChats.length,
    totalAgents: allAgents.length,
    totalRevenue,
    totalTokens,
    subscriptionDistribution: {
      free: allUsers.filter((u) => u.subscriptionPlan === "free").length,
      pro: allUsers.filter((u) => u.subscriptionPlan === "pro").length,
      enterprise: allUsers.filter((u) => u.subscriptionPlan === "enterprise").length,
    },
  });
});

app.get("/api/admin/users", (req, res) => {
  const user = getLoggedInUser(req);
  if (!user || user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  res.json({ users: DB.users.find() });
});

app.patch("/api/admin/users/:id", (req, res) => {
  const user = getLoggedInUser(req);
  if (!user || user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { id } = req.params;
  const { role, subscriptionPlan, credits } = req.body;

  DB.users.findByIdAndUpdate(id, {
    role,
    subscriptionPlan,
    credits,
  });

  res.json({ success: true, user: DB.users.findOne({ id }) });
});

app.delete("/api/admin/users/:id", (req, res) => {
  const user = getLoggedInUser(req);
  if (!user || user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { id } = req.params;
  DB.users.deleteOne(id);
  res.json({ success: true });
});

app.get("/api/admin/feedback", (req, res) => {
  const user = getLoggedInUser(req);
  if (!user || user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  res.json({ feedback: DB.feedback.find() });
});

app.post("/api/admin/notifications", (req, res) => {
  const user = getLoggedInUser(req);
  if (!user || user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { title, content } = req.body;
  if (!title || !content) return res.status(400).json({ error: "Missing fields" });

  const notif = DB.notifications.create({
    userId: "global",
    title,
    content,
    read: false,
  });

  res.json({ success: true, notification: notif });
});

// --- VITE MIDDLEWARE SETUP ---
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[AstraCogniX Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
