import { 
  users, leads, prospects, dispatches, settings, metrics, 
  aiAgent, aiAgentSteps, aiAgentFaqs 
} from "@shared/schema";
import type {
  User, InsertUser, Lead, InsertLead, Prospect, InsertProspect, 
  Dispatch, InsertDispatch, Settings, InsertSettings, Metric,
  AiAgent, InsertAiAgent, AiAgentSteps, InsertAiAgentSteps,
  AiAgentFaqs, InsertAiAgentFaqs 
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import connectPg from "connect-pg-simple";
import pg from "pg";
import { db } from "./db";
import { eq, and, desc, count } from "drizzle-orm";

const MemoryStore = createMemoryStore(session);
const PostgresSessionStore = connectPg(session);

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
  
  // AI Agent methods
  getAiAgentByUserId(userId: number): Promise<AiAgent | undefined>;
  createAiAgent(agentData: InsertAiAgent & { userId: number }): Promise<AiAgent>;
  updateAiAgent(userId: number, agentData: Partial<InsertAiAgent>): Promise<AiAgent | undefined>;
  
  // AI Agent Steps methods
  getAiAgentSteps(userId: number): Promise<AiAgentSteps[]>;
  getAiAgentStep(id: number): Promise<AiAgentSteps | undefined>;
  createAiAgentStep(stepData: InsertAiAgentSteps & { userId: number }): Promise<AiAgentSteps>;
  updateAiAgentStep(id: number, stepData: Partial<InsertAiAgentSteps>): Promise<AiAgentSteps | undefined>;
  deleteAiAgentStep(id: number): Promise<boolean>;
  
  // AI Agent FAQs methods
  getAiAgentFaqs(userId: number): Promise<AiAgentFaqs[]>;
  getAiAgentFaq(id: number): Promise<AiAgentFaqs | undefined>;
  createAiAgentFaq(faqData: InsertAiAgentFaqs & { userId: number }): Promise<AiAgentFaqs>;
  updateAiAgentFaq(id: number, faqData: Partial<InsertAiAgentFaqs>): Promise<AiAgentFaqs | undefined>;
  deleteAiAgentFaq(id: number): Promise<boolean>;
  
  // Session store
  sessionStore: session.Store;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private leads: Map<number, Lead>;
  private prospects: Map<number, Prospect>;
  private dispatches: Map<number, Dispatch>;
  private settings: Map<number, Settings>;
  private metrics: Map<number, Metric>;
  private aiAgents: Map<number, AiAgent>;
  private aiAgentSteps: Map<number, AiAgentSteps>;
  private aiAgentFaqs: Map<number, AiAgentFaqs>;
  
  sessionStore: session.Store;
  currentId: { [key: string]: number };

  constructor() {
    this.users = new Map();
    this.leads = new Map();
    this.prospects = new Map();
    this.dispatches = new Map();
    this.settings = new Map();
    this.metrics = new Map();
    this.aiAgents = new Map();
    this.aiAgentSteps = new Map();
    this.aiAgentFaqs = new Map();
    
    this.currentId = {
      users: 1,
      leads: 1,
      prospects: 1,
      dispatches: 1,
      settings: 1,
      metrics: 1,
      aiAgents: 1,
      aiAgentSteps: 1,
      aiAgentFaqs: 1
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
    const user: User = { 
      ...insertUser, 
      id,
      name: insertUser.name || null,
      company: insertUser.company || null,
      phone: insertUser.phone || null,
      bio: insertUser.bio || null,
      avatarUrl: null
    };
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
    const newLead: Lead = { 
      ...lead, 
      id, 
      createdAt: now,
      email: lead.email || null,
      company: lead.company || null,
      phone: lead.phone || null,
      status: lead.status || null,
      userId: lead.userId
    };
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
    const newProspect: Prospect = { 
      ...prospect, 
      id, 
      createdAt: now,
      email: prospect.email || null,
      company: prospect.company || null,
      phone: prospect.phone || null,
      status: prospect.status || null,
      userId: prospect.userId
    };
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
      status: dispatch.status || null,
      sentAt: dispatch.status === 'enviado' ? now : null
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
    const settings: Settings = { 
      id,
      userId: settingsData.userId,
      logoUrl: settingsData.logoUrl || null,
      primaryColor: settingsData.primaryColor || null,
      secondaryColor: settingsData.secondaryColor || null,
      darkMode: settingsData.darkMode || null
    };
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
  
  // AI Agent methods
  async getAiAgentByUserId(userId: number): Promise<AiAgent | undefined> {
    return Array.from(this.aiAgents.values()).find(agent => agent.userId === userId);
  }
  
  async createAiAgent(agentData: InsertAiAgent & { userId: number }): Promise<AiAgent> {
    const id = this.currentId.aiAgents++;
    const now = new Date();
    const agent: AiAgent = {
      id,
      userId: agentData.userId,
      enabled: agentData.enabled || false,
      triggerText: agentData.triggerText || null,
      personality: agentData.personality || null,
      expertise: agentData.expertise || null,
      voiceTone: agentData.voiceTone || null,
      rules: agentData.rules || null,
      followUpEnabled: agentData.followUpEnabled || false,
      followUpCount: agentData.followUpCount || 0,
      messageInterval: agentData.messageInterval || '30 minutos',
      followUpPrompt: agentData.followUpPrompt || null,
      schedulingEnabled: agentData.schedulingEnabled || false,
      agendaId: agentData.agendaId || null,
      schedulingPromptConsult: agentData.schedulingPromptConsult || null,
      schedulingPromptTime: agentData.schedulingPromptTime || null,
      schedulingDuration: agentData.schedulingDuration || null,
      createdAt: now,
      updatedAt: now
    };
    this.aiAgents.set(id, agent);
    return agent;
  }
  
  async updateAiAgent(userId: number, agentData: Partial<InsertAiAgent>): Promise<AiAgent | undefined> {
    const agent = await this.getAiAgentByUserId(userId);
    if (!agent) return undefined;
    
    const updatedAgent = {
      ...agent,
      ...agentData,
      updatedAt: new Date()
    };
    this.aiAgents.set(agent.id, updatedAgent);
    return updatedAgent;
  }
  
  // AI Agent Steps methods
  async getAiAgentSteps(userId: number): Promise<AiAgentSteps[]> {
    return Array.from(this.aiAgentSteps.values())
      .filter(step => step.userId === userId)
      .sort((a, b) => a.order - b.order);
  }
  
  async getAiAgentStep(id: number): Promise<AiAgentSteps | undefined> {
    return this.aiAgentSteps.get(id);
  }
  
  async createAiAgentStep(stepData: InsertAiAgentSteps & { userId: number }): Promise<AiAgentSteps> {
    const id = this.currentId.aiAgentSteps++;
    const now = new Date();
    const step: AiAgentSteps = {
      id,
      userId: stepData.userId,
      name: stepData.name,
      description: stepData.description || null,
      order: stepData.order,
      createdAt: now
    };
    this.aiAgentSteps.set(id, step);
    return step;
  }
  
  async updateAiAgentStep(id: number, stepData: Partial<InsertAiAgentSteps>): Promise<AiAgentSteps | undefined> {
    const step = await this.getAiAgentStep(id);
    if (!step) return undefined;
    
    const updatedStep = { ...step, ...stepData };
    this.aiAgentSteps.set(id, updatedStep);
    return updatedStep;
  }
  
  async deleteAiAgentStep(id: number): Promise<boolean> {
    if (!this.aiAgentSteps.has(id)) return false;
    return this.aiAgentSteps.delete(id);
  }
  
  // AI Agent FAQs methods
  async getAiAgentFaqs(userId: number): Promise<AiAgentFaqs[]> {
    return Array.from(this.aiAgentFaqs.values()).filter(faq => faq.userId === userId);
  }
  
  async getAiAgentFaq(id: number): Promise<AiAgentFaqs | undefined> {
    return this.aiAgentFaqs.get(id);
  }
  
  async createAiAgentFaq(faqData: InsertAiAgentFaqs & { userId: number }): Promise<AiAgentFaqs> {
    const id = this.currentId.aiAgentFaqs++;
    const now = new Date();
    const faq: AiAgentFaqs = {
      id,
      userId: faqData.userId,
      question: faqData.question,
      answer: faqData.answer,
      createdAt: now
    };
    this.aiAgentFaqs.set(id, faq);
    return faq;
  }
  
  async updateAiAgentFaq(id: number, faqData: Partial<InsertAiAgentFaqs>): Promise<AiAgentFaqs | undefined> {
    const faq = await this.getAiAgentFaq(id);
    if (!faq) return undefined;
    
    const updatedFaq = { ...faq, ...faqData };
    this.aiAgentFaqs.set(id, updatedFaq);
    return updatedFaq;
  }
  
  async deleteAiAgentFaq(id: number): Promise<boolean> {
    if (!this.aiAgentFaqs.has(id)) return false;
    return this.aiAgentFaqs.delete(id);
  }
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
  }
  
  // AI Agent methods
  async getAiAgentByUserId(userId: number): Promise<AiAgent | undefined> {
    const [agentData] = await db
      .select()
      .from(aiAgent)
      .where(eq(aiAgent.userId, userId));
    return agentData;
  }
  
  async createAiAgent(agentData: InsertAiAgent & { userId: number }): Promise<AiAgent> {
    const [newAgent] = await db
      .insert(aiAgent)
      .values(agentData)
      .returning();
    return newAgent;
  }
  
  async updateAiAgent(userId: number, agentData: Partial<InsertAiAgent>): Promise<AiAgent | undefined> {
    const [updatedAgent] = await db
      .update(aiAgent)
      .set(agentData)
      .where(eq(aiAgent.userId, userId))
      .returning();
    return updatedAgent;
  }
  
  // AI Agent Steps methods
  async getAiAgentSteps(userId: number): Promise<AiAgentSteps[]> {
    return db
      .select()
      .from(aiAgentSteps)
      .where(eq(aiAgentSteps.userId, userId))
      .orderBy(aiAgentSteps.order);
  }
  
  async getAiAgentStep(id: number): Promise<AiAgentSteps | undefined> {
    const [step] = await db
      .select()
      .from(aiAgentSteps)
      .where(eq(aiAgentSteps.id, id));
    return step;
  }
  
  async createAiAgentStep(stepData: InsertAiAgentSteps & { userId: number }): Promise<AiAgentSteps> {
    const [newStep] = await db
      .insert(aiAgentSteps)
      .values(stepData)
      .returning();
    return newStep;
  }
  
  async updateAiAgentStep(id: number, stepData: Partial<InsertAiAgentSteps>): Promise<AiAgentSteps | undefined> {
    const [updatedStep] = await db
      .update(aiAgentSteps)
      .set(stepData)
      .where(eq(aiAgentSteps.id, id))
      .returning();
    return updatedStep;
  }
  
  async deleteAiAgentStep(id: number): Promise<boolean> {
    const result = await db
      .delete(aiAgentSteps)
      .where(eq(aiAgentSteps.id, id));
    return !!result;
  }
  
  // AI Agent FAQs methods
  async getAiAgentFaqs(userId: number): Promise<AiAgentFaqs[]> {
    return db
      .select()
      .from(aiAgentFaqs)
      .where(eq(aiAgentFaqs.userId, userId));
  }
  
  async getAiAgentFaq(id: number): Promise<AiAgentFaqs | undefined> {
    const [faq] = await db
      .select()
      .from(aiAgentFaqs)
      .where(eq(aiAgentFaqs.id, id));
    return faq;
  }
  
  async createAiAgentFaq(faqData: InsertAiAgentFaqs & { userId: number }): Promise<AiAgentFaqs> {
    const [newFaq] = await db
      .insert(aiAgentFaqs)
      .values(faqData)
      .returning();
    return newFaq;
  }
  
  async updateAiAgentFaq(id: number, faqData: Partial<InsertAiAgentFaqs>): Promise<AiAgentFaqs | undefined> {
    const [updatedFaq] = await db
      .update(aiAgentFaqs)
      .set(faqData)
      .where(eq(aiAgentFaqs.id, id))
      .returning();
    return updatedFaq;
  }
  
  async deleteAiAgentFaq(id: number): Promise<boolean> {
    const result = await db
      .delete(aiAgentFaqs)
      .where(eq(aiAgentFaqs.id, id));
    return !!result;
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  async getLead(id: number): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.id, id));
    return lead;
  }

  async getLeadsByUserId(userId: number): Promise<Lead[]> {
    return db.select().from(leads).where(eq(leads.userId, userId));
  }

  async createLead(lead: InsertLead & { userId: number }): Promise<Lead> {
    const [newLead] = await db
      .insert(leads)
      .values(lead)
      .returning();
    return newLead;
  }

  async countLeadsByUserId(userId: number): Promise<number> {
    const result = await db.select({ count: count() }).from(leads).where(eq(leads.userId, userId));
    return result[0]?.count || 0;
  }

  async getProspect(id: number): Promise<Prospect | undefined> {
    const [prospect] = await db.select().from(prospects).where(eq(prospects.id, id));
    return prospect;
  }

  async getProspectsByUserId(userId: number): Promise<Prospect[]> {
    return db.select().from(prospects).where(eq(prospects.userId, userId));
  }

  async createProspect(prospect: InsertProspect & { userId: number }): Promise<Prospect> {
    const [newProspect] = await db
      .insert(prospects)
      .values(prospect)
      .returning();
    return newProspect;
  }

  async countProspectsByUserId(userId: number): Promise<number> {
    const result = await db.select({ count: count() }).from(prospects).where(eq(prospects.userId, userId));
    return result[0]?.count || 0;
  }

  async getDispatch(id: number): Promise<Dispatch | undefined> {
    const [dispatch] = await db.select().from(dispatches).where(eq(dispatches.id, id));
    return dispatch;
  }

  async getDispatchesByUserId(userId: number): Promise<Dispatch[]> {
    return db.select().from(dispatches).where(eq(dispatches.userId, userId));
  }

  async createDispatch(dispatch: InsertDispatch & { userId: number }): Promise<Dispatch> {
    const [newDispatch] = await db
      .insert(dispatches)
      .values(dispatch)
      .returning();
    return newDispatch;
  }

  async countDispatchesByUserId(userId: number): Promise<number> {
    const result = await db.select({ count: count() }).from(dispatches).where(eq(dispatches.userId, userId));
    return result[0]?.count || 0;
  }

  async getSettingsByUserId(userId: number): Promise<Settings | undefined> {
    const [userSettings] = await db.select().from(settings).where(eq(settings.userId, userId));
    return userSettings;
  }

  async createSettings(settingsData: InsertSettings & { userId: number }): Promise<Settings> {
    const [newSettings] = await db
      .insert(settings)
      .values(settingsData)
      .returning();
    return newSettings;
  }

  async updateSettings(userId: number, settingsData: Partial<InsertSettings>): Promise<Settings | undefined> {
    const [updatedSettings] = await db
      .update(settings)
      .set(settingsData)
      .where(eq(settings.userId, userId))
      .returning();
    return updatedSettings;
  }

  async getMetricsByUserAndPeriod(userId: number, month: string, year: number): Promise<Metric | undefined> {
    const [metric] = await db
      .select()
      .from(metrics)
      .where(and(
        eq(metrics.userId, userId),
        eq(metrics.month, month),
        eq(metrics.year, year)
      ));
    return metric;
  }

  async getMetricsByUserId(userId: number): Promise<Metric[]> {
    return db
      .select()
      .from(metrics)
      .where(eq(metrics.userId, userId))
      .orderBy(desc(metrics.year), metrics.id);
  }

  async createOrUpdateMetrics(
    userId: number,
    month: string,
    year: number,
    data: { leadsCount?: number, prospectsCount?: number, dispatchesCount?: number }
  ): Promise<Metric> {
    // Check if metrics exist for this period
    const existingMetric = await this.getMetricsByUserAndPeriod(userId, month, year);
    
    if (existingMetric) {
      // Update existing metric
      const [updatedMetric] = await db
        .update(metrics)
        .set(data)
        .where(and(
          eq(metrics.userId, userId),
          eq(metrics.month, month),
          eq(metrics.year, year)
        ))
        .returning();
      return updatedMetric;
    } else {
      // Create new metric
      const [newMetric] = await db
        .insert(metrics)
        .values({
          userId,
          month,
          year,
          leadsCount: data.leadsCount || 0,
          prospectsCount: data.prospectsCount || 0,
          dispatchesCount: data.dispatchesCount || 0
        })
        .returning();
      return newMetric;
    }
  }
}

export const storage = new DatabaseStorage();