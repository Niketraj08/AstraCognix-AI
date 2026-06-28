import fs from "fs";
import path from "path";
import crypto from "crypto";

const DATA_DIR = path.join(process.cwd(), ".data");

// Helper to ensure database directory and files exist
function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

class Collection<T extends { id: string }> {
  private filePath: string;

  constructor(private name: string) {
    ensureDir();
    this.filePath = path.join(DATA_DIR, `${name}.json`);
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify([], null, 2));
    }
  }

  private read(): T[] {
    try {
      if (!fs.existsSync(this.filePath)) {
        return [];
      }
      const data = fs.readFileSync(this.filePath, "utf-8");
      return JSON.parse(data);
    } catch (e) {
      console.error(`Error reading database file: ${this.filePath}`, e);
      return [];
    }
  }

  private write(data: T[]) {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
    } catch (e) {
      console.error(`Error writing database file: ${this.filePath}`, e);
    }
  }

  find(filter?: Partial<T> | ((item: T) => boolean)): T[] {
    const list = this.read();
    if (!filter) return list;
    if (typeof filter === "function") {
      return list.filter(filter);
    }
    return list.filter((item) => {
      for (const key in filter) {
        if (item[key] !== filter[key]) return false;
      }
      return true;
    });
  }

  findOne(filter: Partial<T> | ((item: T) => boolean)): T | null {
    const results = this.find(filter);
    return results.length > 0 ? results[0] : null;
  }

  create(item: Omit<T, "id" | "createdAt" | "updatedAt"> & { id?: string }): T {
    const list = this.read();
    const now = new Date().toISOString();
    const newItem = {
      id: item.id || crypto.randomUUID(),
      ...item,
      createdAt: now,
      updatedAt: now,
    } as unknown as T;
    list.push(newItem);
    this.write(list);
    return newItem;
  }

  findByIdAndUpdate(id: string, update: Partial<T>): T | null {
    const list = this.read();
    const index = list.findIndex((item) => item.id === id);
    if (index === -1) return null;
    const now = new Date().toISOString();
    const updatedItem = {
      ...list[index],
      ...update,
      updatedAt: now,
    };
    list[index] = updatedItem;
    this.write(list);
    return updatedItem;
  }

  deleteOne(id: string): boolean {
    const list = this.read();
    const index = list.findIndex((item) => item.id === id);
    if (index === -1) return false;
    list.splice(index, 1);
    this.write(list);
    return true;
  }

  deleteMany(filter: Partial<T>): number {
    const list = this.read();
    const beforeLength = list.length;
    const newList = list.filter((item) => {
      for (const key in filter) {
        if (item[key] !== filter[key]) return true;
      }
      return false;
    });
    this.write(newList);
    return beforeLength - newList.length;
  }
}

// Collections interfaces
export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  avatar: string;
  isVerified: boolean;
  otpCode?: string;
  role: "user" | "admin";
  subscriptionPlan: "free" | "pro" | "enterprise";
  credits: number; // in tokens or queries
  tokenUsage: number;
  rememberMe?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Chat {
  id: string;
  userId: string;
  title: string;
  isPinned: boolean;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  chatId: string;
  role: "user" | "model";
  text: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  ocrText?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Agent {
  id: string;
  userId: string; // can be "system" or specific user
  name: string;
  avatar: string;
  instructions: string;
  personality: string;
  knowledgeBase?: string[]; // list of names
  memoryEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  userId: string; // can be "global" or specific user
  title: string;
  content: string;
  read: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Feedback {
  id: string;
  userId: string;
  userName: string;
  text: string;
  rating: number;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  userId: string;
  amount: number;
  plan: string;
  status: "success" | "pending" | "failed";
  razorpayPaymentId: string;
  createdAt: string;
  updatedAt: string;
}

// DB export instances
export const DB = {
  users: new Collection<User>("users"),
  chats: new Collection<Chat>("chats"),
  messages: new Collection<Message>("messages"),
  agents: new Collection<Agent>("agents"),
  notifications: new Collection<Notification>("notifications"),
  feedback: new Collection<Feedback>("feedback"),
  payments: new Collection<Payment>("payments"),
};

// Seed system data
export function seedDB() {
  // 1. Seed global admin user if none exists
  const adminEmail = "admin@astracognix.ai";
  const existingAdmin = DB.users.findOne({ email: adminEmail });
  if (!existingAdmin) {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.pbkdf2Sync("admin123", salt, 1000, 64, "sha512").toString("hex");
    DB.users.create({
      email: adminEmail,
      name: "Admin Astra",
      passwordHash: `${salt}:${hash}`,
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200",
      isVerified: true,
      role: "admin",
      subscriptionPlan: "enterprise",
      credits: 999999,
      tokenUsage: 1250,
    });
  }

  // Seed demo user
  const demoEmail = "demo@astracognix.ai";
  const existingDemo = DB.users.findOne({ email: demoEmail });
  if (!existingDemo) {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.pbkdf2Sync("demo123", salt, 1000, 64, "sha512").toString("hex");
    DB.users.create({
      email: demoEmail,
      name: "Demo Explorer",
      passwordHash: `${salt}:${hash}`,
      avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200",
      isVerified: true,
      role: "user",
      subscriptionPlan: "pro",
      credits: 50000,
      tokenUsage: 4200,
    });
  }

  // 2. Seed initial System AI Agents
  const existingAgents = DB.agents.find();
  if (existingAgents.length === 0) {
    DB.agents.create({
      userId: "system",
      name: "Professor Astra",
      avatar: "🎓",
      instructions: "You are an elite academic professor in computer science and science. Speak concisely, clearly, and give step-by-step explanations.",
      personality: "Analytical, academic, encouraging",
      memoryEnabled: true,
    });

    DB.agents.create({
      userId: "system",
      name: "Creative Muse",
      avatar: "🎨",
      instructions: "You are a creative writer and storyteller. Use rich metaphors and paint vivid imagery in your responses.",
      personality: "Expressive, imaginative, warm",
      memoryEnabled: false,
    });

    DB.agents.create({
      userId: "system",
      name: "Socrates Chatbot",
      avatar: "🏛️",
      instructions: "You are a Socratic tutor. Instead of giving answers directly, ask thought-provoking questions to lead the user to discover answers themselves.",
      personality: "Philosophical, questioning, patient",
      memoryEnabled: true,
    });
  }

  // 3. Seed notifications
  const existingNotifications = DB.notifications.find();
  if (existingNotifications.length === 0) {
    DB.notifications.create({
      userId: "global",
      title: "Welcome to AstraCogniX AI v1.0!",
      content: "Thank you for joining AstraCogniX AI. Experience the future of AI with multi-modal inputs, custom agents, and real-time streaming.",
      read: false,
    });
    DB.notifications.create({
      userId: "global",
      title: "Introducing AI Agent Workspace",
      content: "Create your own customized AI assistants with instructions and memory toggles. Try it out in the Agent tab!",
      read: false,
    });
  }
}
