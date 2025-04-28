import { users, leads, prospects, dispatches, metrics, settings } from "@shared/schema";
import type { User, InsertUser, Lead, InsertLead, Prospect, InsertProspect, Dispatch, InsertDispatch, Settings, InsertSettings, Metric } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined>;
  
  // Lead methods
  getLead(id: number): Promise<Lead | undefined>;
  getLeadsByUserId(userId: number): Promise<Lead[]>;
  createLead(lead: InsertLead & { userId: number }): Promise<Lead>;
  countLeadsByUserId(userId: number): Promise<number>;
  
  // Prospect methods
  getProspect(id: number): Promise<Prospect | undefined>;
  getProspectsByUserId(userId: number): Promise<Prospect[]>;
  createProspect(prospect: InsertProspect & { userId: number }): Promise<Prospect>;
  countProspectsByUserId(userId: number): Promise<number>;
  
  // Dispatch methods
  getDispatch(id: number): Promise<Dispatch | undefined>;
  getDispatchesByUserId(userId: number): Promise<Dispatch[]>;
  createDispatch(dispatch: InsertDispatch & { userId: number }): Promise<Dispatch>;
  countDispatchesByUserId(userId: number): Promise<number>;
  
  // Settings methods
  getSettingsByUserId(userId: number): Promise<Settings | undefined>;
  createSettings(settings: InsertSettings & { userId: number }): Promise<Settings>;
  updateSettings(userId: number, settingsData: Partial<InsertSettings>): Promise<Settings | undefined>;
  
  // Metrics methods
  getMetricsByUserAndPeriod(userId: number, month: string, year: number): Promise<Metric | undefined>;
  getMetricsByUserId(userId: number): Promise<Metric[]>;
  createOrUpdateMetrics(userId: number, month: string, year: number, data: { leadsCount?: number, prospectsCount?: number, dispatchesCount?: number }): Promise<Metric>;
  
  // Session store
  sessionStore: session.SessionStore;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private leads: Map<number, Lead>;
  private prospects: Map<number, Prospect>;
  private dispatches: Map<number, Dispatch>;
  private settings: Map<number, Settings>;
  private metrics: Map<number, Metric>;
  
  sessionStore: session.SessionStore;
  currentId: { [key: string]: number };

  constructor() {
    this.users = new Map();
    this.leads = new Map();
    this.prospects = new Map();
    this.dispatches = new Map();
    this.settings = new Map();
    this.metrics = new Map();
    
    this.currentId = {
      users: 1,
      leads: 1,
      prospects: 1,
      dispatches: 1,
      settings: 1,
      metrics: 1
    };
    
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // Prune expired entries every 24h
    });
  }
  
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId.users++;
    const now = new Date();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  
  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined> {
    const user = await this.getUser(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...userData };
    this.users.set(id, updatedUser);
    return updatedUser;
  }
  
  // Lead methods
  async getLead(id: number): Promise<Lead | undefined> {
    return this.leads.get(id);
  }
  
  async getLeadsByUserId(userId: number): Promise<Lead[]> {
    return Array.from(this.leads.values()).filter(lead => lead.userId === userId);
  }
  
  async createLead(lead: InsertLead & { userId: number }): Promise<Lead> {
    const id = this.currentId.leads++;
    const now = new Date();
    const newLead: Lead = { ...lead, id, createdAt: now };
    this.leads.set(id, newLead);
    
    // Update metrics
    const month = now.toLocaleString('default', { month: 'long' });
    const year = now.getFullYear();
    await this.createOrUpdateMetrics(lead.userId, month, year, { leadsCount: 1 });
    
    return newLead;
  }
  
  async countLeadsByUserId(userId: number): Promise<number> {
    return (await this.getLeadsByUserId(userId)).length;
  }
  
  // Prospect methods
  async getProspect(id: number): Promise<Prospect | undefined> {
    return this.prospects.get(id);
  }
  
  async getProspectsByUserId(userId: number): Promise<Prospect[]> {
    return Array.from(this.prospects.values()).filter(prospect => prospect.userId === userId);
  }
  
  async createProspect(prospect: InsertProspect & { userId: number }): Promise<Prospect> {
    const id = this.currentId.prospects++;
    const now = new Date();
    const newProspect: Prospect = { ...prospect, id, createdAt: now };
    this.prospects.set(id, newProspect);
    
    // Update metrics
    const month = now.toLocaleString('default', { month: 'long' });
    const year = now.getFullYear();
    await this.createOrUpdateMetrics(prospect.userId, month, year, { prospectsCount: 1 });
    
    return newProspect;
  }
  
  async countProspectsByUserId(userId: number): Promise<number> {
    return (await this.getProspectsByUserId(userId)).length;
  }
  
  // Dispatch methods
  async getDispatch(id: number): Promise<Dispatch | undefined> {
    return this.dispatches.get(id);
  }
  
  async getDispatchesByUserId(userId: number): Promise<Dispatch[]> {
    return Array.from(this.dispatches.values()).filter(dispatch => dispatch.userId === userId);
  }
  
  async createDispatch(dispatch: InsertDispatch & { userId: number }): Promise<Dispatch> {
    const id = this.currentId.dispatches++;
    const now = new Date();
    const newDispatch: Dispatch = { 
      ...dispatch, 
      id, 
      createdAt: now,
      sentAt: dispatch.status === 'enviado' ? now : undefined
    };
    this.dispatches.set(id, newDispatch);
    
    // Update metrics
    const month = now.toLocaleString('default', { month: 'long' });
    const year = now.getFullYear();
    await this.createOrUpdateMetrics(dispatch.userId, month, year, { dispatchesCount: 1 });
    
    return newDispatch;
  }
  
  async countDispatchesByUserId(userId: number): Promise<number> {
    return (await this.getDispatchesByUserId(userId)).length;
  }
  
  // Settings methods
  async getSettingsByUserId(userId: number): Promise<Settings | undefined> {
    return Array.from(this.settings.values()).find(setting => setting.userId === userId);
  }
  
  async createSettings(settingsData: InsertSettings & { userId: number }): Promise<Settings> {
    const id = this.currentId.settings++;
    const settings: Settings = { ...settingsData, id };
    this.settings.set(id, settings);
    return settings;
  }
  
  async updateSettings(userId: number, settingsData: Partial<InsertSettings>): Promise<Settings | undefined> {
    const existingSettings = await this.getSettingsByUserId(userId);
    
    if (existingSettings) {
      const updatedSettings = { ...existingSettings, ...settingsData };
      this.settings.set(existingSettings.id, updatedSettings);
      return updatedSettings;
    }
    
    // If settings don't exist, create them
    return this.createSettings({ 
      userId, 
      logoUrl: settingsData.logoUrl || null,
      primaryColor: settingsData.primaryColor || "#047857", 
      secondaryColor: settingsData.secondaryColor || "#4f46e5",
      darkMode: settingsData.darkMode !== undefined ? settingsData.darkMode : false
    });
  }
  
  // Metrics methods
  async getMetricsByUserAndPeriod(userId: number, month: string, year: number): Promise<Metric | undefined> {
    return Array.from(this.metrics.values()).find(
      metric => metric.userId === userId && metric.month === month && metric.year === year
    );
  }
  
  async getMetricsByUserId(userId: number): Promise<Metric[]> {
    return Array.from(this.metrics.values()).filter(metric => metric.userId === userId);
  }
  
  async createOrUpdateMetrics(
    userId: number, 
    month: string, 
    year: number, 
    data: { leadsCount?: number, prospectsCount?: number, dispatchesCount?: number }
  ): Promise<Metric> {
    const existingMetrics = await this.getMetricsByUserAndPeriod(userId, month, year);
    
    if (existingMetrics) {
      const updatedMetrics = { 
        ...existingMetrics,
        leadsCount: (existingMetrics.leadsCount || 0) + (data.leadsCount || 0),
        prospectsCount: (existingMetrics.prospectsCount || 0) + (data.prospectsCount || 0),
        dispatchesCount: (existingMetrics.dispatchesCount || 0) + (data.dispatchesCount || 0),
      };
      this.metrics.set(existingMetrics.id, updatedMetrics);
      return updatedMetrics;
    }
    
    // If metrics don't exist for this period, create them
    const id = this.currentId.metrics++;
    const now = new Date();
    const newMetrics: Metric = {
      id,
      userId,
      month,
      year,
      leadsCount: data.leadsCount || 0,
      prospectsCount: data.prospectsCount || 0,
      dispatchesCount: data.dispatchesCount || 0,
      createdAt: now
    };
    
    this.metrics.set(id, newMetrics);
    return newMetrics;
  }
}

export const storage = new MemStorage();
