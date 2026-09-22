/** Shared domain types for the RetailOps mobile app. */

export interface Role {
  Name?: string;
  DisplayName?: string;
  name?: string;
  displayName?: string;
}

export interface Seller {
  Id: string;
  Name: string;
  Marketplace?: string;
  SellerId?: string;
  IsActive?: boolean;
  Plan?: string;
  PartnerTag?: string;
}

export interface User {
  id: string;
  _id?: string;
  Email?: string;
  email?: string;
  FirstName?: string;
  LastName?: string;
  firstName?: string;
  lastName?: string;
  fullName: string;
  role: Role;
  permissions: string[];
  sellers?: Seller[];
  assignedSellers?: string[];
  isFirstLogin?: boolean;
  Avatar?: string;
  Phone?: string;
  phone?: string;
  preferences?: Record<string, unknown>;
  CreatedAt?: string;
  createdAt?: string;
  LastSeen?: string;
  lastSeen?: string;
  PasswordChangedAt?: string;
  passwordChangedAt?: string;
  SetupCompletedAt?: string;
  IsActive?: boolean;
  isActive?: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
}

export interface LoginSuccessData {
  user: User;
  accessToken: string;
  refreshToken?: string;
}

export interface LoginResponse {
  success: boolean;

  /** Present when the account is already trusted (no OTP step). */
  data?: LoginSuccessData;

  /** Present when an OTP must be verified. */
  requiresOtp?: boolean;

  tempToken?: string;
  destination?: string;
  expiresIn?: number;
  message?: string;
  requiresSetup?: boolean;
  needsPasswordReset?: boolean;
  trustedDevice?: boolean;
}

export interface VerifyOtpResponse {
  success: boolean;
  data?: LoginSuccessData;
  requiresSetup?: boolean;
  needsPasswordReset?: boolean;
  message?: string;
}

/** Raw user row returned by `PUT /auth/profile`. */
export type UpdateProfileData = Record<string, unknown>;

export interface UpdateProfileResponse {
  success: boolean;
  data?: UpdateProfileData;
  message?: string;
}

/** `POST /auth/request-password-change` — starts the password-change OTP flow. */
export interface RequestPasswordChangeResponse {
  success: boolean;
  tempToken?: string;
  destination?: string;
  expiresIn?: number;
  message?: string;
}

/** `PUT /auth/change-password-with-otp` / `PUT /auth/change-password`. */
export interface ChangePasswordResponse {
  success: boolean;
  message?: string;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string;
  [key: string]: unknown;
}

/**
 * Route params for the root stack.
 */
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

/**
 * Authentication stack.
 */
export type AuthStackParamList = {
  Login: undefined;
  Otp: {
    tempToken: string;
    destination?: string;
  };
};

/**
 * Main drawer routes for the authenticated RetailOps app.
 *
 * Navigation is organized around seller workflows:
 * Catalog → Operations → Growth → Business → Account.
 */
/** Params passed to the shared `PlaceholderScreen` via `Drawer.Screen initialParams`. */
export type PlaceholderParams = {
  title?: string;
  description?: string;
  icon?: string;
};

export type MainDrawerParamList = {
  // Home
  Dashboard: undefined;
  Notifications: undefined;
  Messages: undefined;

  // Catalog
  Products: undefined;
  Listings: PlaceholderParams;
  Inventory: PlaceholderParams;
  Pricing: PlaceholderParams;

  // Operations
  Orders: PlaceholderParams;
  Tasks: undefined;
  Marketplaces: PlaceholderParams;

  // Growth
  Advertising: undefined;
  Deals: PlaceholderParams;
  Performance: PlaceholderParams;

  // Business
  Reports: PlaceholderParams;
  Support: PlaceholderParams;

  // Account
  Settings: PlaceholderParams;
  Profile: undefined;
};

/** A row returned by `GET /api/notifications`. */
export interface AppNotification {
  Id: string;
  RecipientId?: string;
  Type?: string;
  ReferenceModel?: string;
  ReferenceId?: string;
  Message?: string;
  IsRead?: boolean;
  CreatedAt?: string;
  _id?: string;
  [key: string]: unknown;
}

export interface NotificationsPage {
  data: AppNotification[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  unreadCount: number;
}

/**
 * Messaging (chat) — `/api/messaging`.
 */
export type ChatMessageType = 'TEXT' | 'IMAGE' | 'FILE';

export interface ChatMessage {
  _id: string;
  id: string;
  conversationId: string;
  senderId: string;
  senderName?: string;
  type: ChatMessageType;
  content: string;
  attachmentUrl?: string;
  attachmentName?: string;
  createdAt: string;
  readBy: string[];
  pending?: boolean;
  failed?: boolean;
}

export interface ChatParticipant {
  _id: string;
  name: string;
  avatar?: string;
  roleName?: string;
  lastReadAt?: string | null;
  isAdmin?: boolean;
}

export interface ChatLastMessage {
  _id: string;
  senderId: string;
  senderName?: string;
  type: ChatMessageType;
  content: string;
  attachmentUrl?: string;
  attachmentName?: string;
  createdAt: string;
}

export interface ChatConversation {
  _id: string;
  id: string;
  type: 'DIRECT' | 'GROUP';
  title?: string | null;
  sellerId?: string | null;
  createdById?: string;
  lastMessage?: ChatLastMessage | null;
  unreadCount: number;
  participants: ChatParticipant[];
  updatedAt: string;
  createdAt: string;
}

export interface ChatContact {
  _id: string;
  name: string;
  email?: string;
  avatar?: string;
  roleName?: string;
}

/** Stack for the in-app messaging (chat) module. */
export type MessagesStackParamList = {
  MessagesList: undefined;
  NewChat: undefined;
  Chat: {
    conversationId: string;
    title?: string;
  };
};