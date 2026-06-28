export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string;
  role: "user" | "admin";
  subscriptionPlan: "free" | "pro" | "enterprise";
  credits: number;
  tokenUsage: number;
  isVerified: boolean;
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
  userId: string;
  name: string;
  avatar: string;
  instructions: string;
  personality: string;
  memoryEnabled: boolean;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  content: string;
  read: boolean;
  createdAt: string;
}

export interface Payment {
  id: string;
  userId: string;
  amount: number;
  plan: string;
  status: string;
  razorpayPaymentId: string;
  createdAt: string;
}

export interface Feedback {
  id: string;
  userName: string;
  text: string;
  rating: number;
  createdAt: string;
}
