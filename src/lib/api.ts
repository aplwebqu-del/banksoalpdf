import {
  BankSoal,
  User,
  StatsOverview,
  CategoryItem,
  AuditLogItem,
  UserHistoryItem,
  FilterParams,
  GoogleIntegrationConfig,
  DriveSyncResult,
  MigrationReport,
  ConnectionTestResult,
} from '../types';
import { googleAppsScriptService, GOOGLE_APPS_SCRIPT_URL } from '../services/googleAppsScript';

export { googleAppsScriptService, GOOGLE_APPS_SCRIPT_URL };

let activeUserId: string = 'u-1';

export function setApiActiveUser(userId: string) {
  activeUserId = userId;
  localStorage.setItem('bank_soal_user_id', userId);
}

export function getApiActiveUser(): string {
  const saved = localStorage.getItem('bank_soal_user_id');
  if (saved) activeUserId = saved;
  return activeUserId;
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('x-user-id', getApiActiveUser());
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    let errMsg = 'Terjadi kesalahan sistem';
    try {
      const errJson = await res.json();
      errMsg = errJson.error || errJson.message || errMsg;
    } catch {
      errMsg = `HTTP Error ${res.status}: ${res.statusText}`;
    }
    throw new Error(errMsg);
  }
  return res.json() as Promise<T>;
}

export const api = {
  // Auth
  getCurrentUser: () => request<{ user: User }>('/api/auth/me'),
  getUsers: () => request<{ users: User[] }>('/api/auth/users'),
  login: (email: string, password?: string) =>
    request<{ success: boolean; user: User; token?: string; message?: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request<{ success: boolean; message?: string }>('/api/auth/logout', { method: 'POST' }),
  updateProfile: (profile: Partial<User>) =>
    request<{ success: boolean; user: User; message?: string }>('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(profile),
    }),
  switchUser: (userId: string) => {
    setApiActiveUser(userId);
    return request<{ success: boolean; user: User }>('/api/auth/switch', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  },

  // User Management (Admin)
  getUsersList: () => request<{ success: boolean; users: User[] }>('/api/users'),
  createUser: (userData: Partial<User>) =>
    request<{ success: boolean; user: User; message?: string }>('/api/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    }),
  updateUser: (id: string, userData: Partial<User>) =>
    request<{ success: boolean; user: User; message?: string }>(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    }),
  deleteUser: (id: string) =>
    request<{ success: boolean; message?: string }>(`/api/users/${id}`, {
      method: 'DELETE',
    }),
  updateUserStatus: (id: string, status: 'ACTIVE' | 'INACTIVE') =>
    request<{ success: boolean; user: User; message?: string }>(`/api/users/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),

  // Health
  getHealth: () => request<any>('/api/health'),

  // Trash & Permanent Deletion
  getTrashCount: () => request<{ count: number }>('/api/trash/count'),
  restoreBankSoal: (id: string) =>
    request<{ success: boolean; message: string }>(`/api/bank-soal/${id}/restore`, {
      method: 'POST',
    }),
  permanentDeleteBankSoal: (id: string) =>
    request<{ success: boolean; message: string }>(`/api/bank-soal/${id}/permanent`, {
      method: 'DELETE',
    }),
  emptyTrash: () =>
    request<{ success: boolean; message: string; count: number }>('/api/bank-soal/empty-trash', {
      method: 'POST',
    }),

  // Google Integration Management & Multi Storage
  getGoogleConfig: () => request<{ config: GoogleIntegrationConfig }>('/api/google/config'),
  saveGoogleConfig: (config: Partial<GoogleIntegrationConfig>) =>
    request<{ success: boolean; config: GoogleIntegrationConfig }>('/api/google/config', {
      method: 'POST',
      body: JSON.stringify(config),
    }),
  testGoogleConnection: () => request<ConnectionTestResult>('/api/google/test-connection', { method: 'POST' }),
  syncGoogleDrive: () => request<DriveSyncResult>('/api/google/sync', { method: 'POST' }),
  syncDriveAndSheets: () => request<DriveSyncResult>('/api/google/sync', { method: 'POST' }),
  runLegacyMigration: (records?: any[]) =>
    request<MigrationReport>('/api/google/migrate-legacy', {
      method: 'POST',
      body: JSON.stringify({ records }),
    }),

  // Multi Google Storage Profiles
  getStorageProfiles: () => googleAppsScriptService.getStorageProfiles(),
  getActiveStorageProfile: () => googleAppsScriptService.getActiveStorageProfile(),
  createStorageProfile: (data: any) => googleAppsScriptService.createStorageProfile(data),
  updateStorageProfile: (id: string, updates: any) => googleAppsScriptService.updateStorageProfile(id, updates),
  deleteStorageProfile: (id: string) => googleAppsScriptService.deleteStorageProfile(id),
  setActiveStorageProfile: (id: string) => googleAppsScriptService.setActiveStorageProfile(id),
  deactivateStorageProfile: (id: string) => googleAppsScriptService.deactivateStorageProfile(id),
  testStorageProfile: (id: string) => googleAppsScriptService.testStorageProfile(id),
  testCustomStorageProfile: (data: any) => googleAppsScriptService.testCustomStorageProfile(data),
  syncStorageProfile: (id?: string) => googleAppsScriptService.syncStorageProfile(id),

  // Bank Soal (from Google Sheets Database Index)
  getBankSoal: (params: FilterParams = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, String(val));
      }
    });
    return request<{ items: BankSoal[]; total: number; page: number; totalPages: number }>(
      `/api/bank-soal?${query.toString()}`
    );
  },

  getBankSoalById: (id: string) => request<{ item: BankSoal }>(`/api/bank-soal/${id}`),

  createBankSoal: (data: any) =>
    request<{ item: BankSoal }>('/api/bank-soal', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateBankSoal: (id: string, data: Partial<BankSoal>) =>
    request<{ item: BankSoal }>(`/api/bank-soal/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteBankSoal: (id: string) =>
    request<{ success: boolean; message: string }>(`/api/bank-soal/${id}`, {
      method: 'DELETE',
    }),

  toggleFavorite: (id: string) =>
    request<{ is_favorite: boolean }>(`/api/bank-soal/${id}/favorite`, {
      method: 'POST',
    }),

  // Upload (Directly to Google Drive & Google Sheets)
  uploadFiles: (formData: FormData) =>
    request<{ files: any[] }>('/api/upload', {
      method: 'POST',
      body: formData,
    }),

  uploadVersion: (id: string, formData: FormData) =>
    request<{ item: BankSoal }>(`/api/bank-soal/${id}/version`, {
      method: 'POST',
      body: formData,
    }),

  checkDuplicates: (hash?: string, title?: string, filename?: string) =>
    request<{ isDuplicate: boolean; matchType?: string; existingItem?: BankSoal }>(
      '/api/check-duplicates',
      {
        method: 'POST',
        body: JSON.stringify({ hash, title, filename }),
      }
    ),

  suggestMetadata: (filename: string, rawText?: string) =>
    request<{ metadata: any }>('/api/ai/suggest-metadata', {
      method: 'POST',
      body: JSON.stringify({ filename, rawText }),
    }),

  // Stats
  getStats: () => request<StatsOverview>('/api/stats'),

  // Categories & Tags
  getCategories: () => request<{ categories: CategoryItem[] }>('/api/categories'),
  createCategory: (cat: { name: string; type: string; code?: string; title?: string; description?: string; icon?: string; color?: string }) =>
    request<{ category: CategoryItem }>('/api/categories', {
      method: 'POST',
      body: JSON.stringify(cat),
    }),
  addCategory: (cat: { name: string; type: string; code?: string; title?: string; description?: string; icon?: string; color?: string }) =>
    request<{ category: CategoryItem }>('/api/categories', {
      method: 'POST',
      body: JSON.stringify(cat),
    }),
  updateCategory: (id: string, cat: Partial<CategoryItem>) =>
    request<{ category: CategoryItem }>(`/api/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(cat),
    }),
  deleteCategory: (id: string) =>
    request<{ success: boolean; message?: string }>(`/api/categories/${id}`, {
      method: 'DELETE',
    }),
  getTags: () => request<{ tags: { tag: string; count: number }[] }>('/api/tags'),

  // Audit Logs & History
  getAuditLogs: () => request<{ logs: AuditLogItem[] }>('/api/audit-logs'),
  getUserHistory: () => request<{ history: UserHistoryItem[] }>('/api/history'),
};
