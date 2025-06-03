import { 
  users, leads, prospects, dispatches, settings, metrics, 
  aiAgent, leadInteractions, leadRecommendations,
  prospectingSearches, prospectingResults, prospectingSchedules, prospectingDispatchHistory,
  messageTemplates, messageSendings, messageSendingHistory,
  whatsappContacts, whatsappMessages, servers, userServers
} from "@shared/schema";
import type {
  User, InsertUser, Lead, InsertLead, Prospect, InsertProspect, 
  Dispatch, InsertDispatch, Settings, InsertSettings, Metric,
  AiAgent, InsertAiAgent, LeadInteraction, InsertLeadInteraction,
  LeadRecommendation, InsertLeadRecommendation, ProspectingSearch, InsertProspectingSearch,
  ProspectingResult, InsertProspectingResult, MessageTemplate, InsertMessageTemplate,
  MessageSending, InsertMessageSending, MessageSendingHistory, InsertMessageSendingHistory,
  WhatsappContact, InsertWhatsappContact, WhatsappMessage, InsertWhatsappMessage,
  Server, InsertServer, UserServer, InsertUserServer
} from "@shared/schema";
// O tipo User também pode ser definido como SelectUser para clareza em algumas operações
import { users as usersSchema } from "@shared/schema";
type SelectUser = typeof usersSchema.$inferSelect;
import session from "express-session";
import createMemoryStore from "memorystore";
import connectPg from "connect-pg-simple";
import pg from "pg";
import { db } from "./db";
import { eq, and, desc, count, inArray } from "drizzle-orm";

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
  getAllUsers(): Promise<User[]>;
  deleteUser(id: number): Promise<boolean>;
  
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
  
  // AI Agent methods (consolidated)
  getAiAgentByUserId(userId: number): Promise<AiAgent | undefined>;
  createAiAgent(agentData: InsertAiAgent & { userId: number }): Promise<AiAgent>;
  updateAiAgent(userId: number, agentData: Partial<InsertAiAgent>): Promise<AiAgent | undefined>;
  
  // Lead Interactions methods
  getLeadInteractions(leadId: number): Promise<LeadInteraction[]>;
  createLeadInteraction(interaction: InsertLeadInteraction & { userId: number }): Promise<LeadInteraction>;
  
  // Lead Recommendations methods
  getLeadRecommendations(userId: number, status?: string): Promise<LeadRecommendation[]>;
  createLeadRecommendation(recommendation: InsertLeadRecommendation & { userId: number }): Promise<LeadRecommendation>;
  updateLeadRecommendationStatus(id: number, status: string): Promise<LeadRecommendation | undefined>;
  generateLeadRecommendations(userId: number): Promise<LeadRecommendation[]>;
  
  // Prospecting Searches methods
  getProspectingSearches(userId: number): Promise<ProspectingSearch[]>;
  getProspectingSearch(id: number): Promise<ProspectingSearch | undefined>;
  createProspectingSearch(search: InsertProspectingSearch & { userId: number }): Promise<ProspectingSearch>;
  updateProspectingSearch(id: number, searchData: Partial<InsertProspectingSearch>): Promise<ProspectingSearch | undefined>;
  deleteProspectingSearch(id: number): Promise<boolean>;
  
  // Prospecting Results methods
  getProspectingResults(searchId: number): Promise<ProspectingResult[]>;
  getProspectingResult(id: number): Promise<ProspectingResult | undefined>;
  createProspectingResult(result: InsertProspectingResult & { searchId: number }): Promise<ProspectingResult>;
  updateProspectingResult(id: number, resultData: Partial<InsertProspectingResult>): Promise<ProspectingResult | undefined>;
  deleteProspectingResult(id: number): Promise<boolean>;
  
  // Prospecting Schedules methods
  getProspectingSchedules(searchId: number): Promise<any[]>;
  createProspectingSchedule(scheduleData: any): Promise<any>;
  
  // Prospecting Dispatch History methods
  getProspectingDispatchHistory(searchId: number): Promise<any[]>;
  createProspectingDispatchHistory(historyData: any): Promise<any>;
  updateProspectingDispatchHistory(id: number, historyData: any): Promise<any>;
  
  // Message Template methods
  getMessageTemplates(userId: number): Promise<MessageTemplate[]>;
  getMessageTemplate(id: number): Promise<MessageTemplate | undefined>;
  createMessageTemplate(template: InsertMessageTemplate & { userId: number }): Promise<MessageTemplate>;
  updateMessageTemplate(id: number, templateData: Partial<InsertMessageTemplate>): Promise<MessageTemplate | undefined>;
  deleteMessageTemplate(id: number): Promise<boolean>;
  
  // Message Sending methods
  getMessageSendings(userId: number): Promise<MessageSending[]>;
  getMessageSending(id: number): Promise<MessageSending | undefined>;
  createMessageSending(sending: InsertMessageSending & { userId: number }): Promise<MessageSending>;
  updateMessageSending(id: number, sendingData: Partial<InsertMessageSending>): Promise<MessageSending | undefined>;
  deleteMessageSending(id: number): Promise<boolean>;
  
  // Message Sending History methods
  getMessageSendingHistory(sendingId: number): Promise<MessageSendingHistory[]>;
  createMessageSendingHistory(history: InsertMessageSendingHistory): Promise<MessageSendingHistory>;
  
  // WhatsApp Contacts methods
  getWhatsappContact(id: number): Promise<WhatsappContact | undefined>;
  getWhatsappContactByContactId(userId: number, contactId: string): Promise<WhatsappContact | undefined>;
  getWhatsappContacts(userId: number): Promise<WhatsappContact[]>;
  createWhatsappContact(contact: InsertWhatsappContact & { userId: number }): Promise<WhatsappContact>;
  updateWhatsappContact(id: number, contactData: Partial<InsertWhatsappContact>): Promise<WhatsappContact | undefined>;
  
  // WhatsApp Messages methods
  getWhatsappMessage(id: number): Promise<WhatsappMessage | undefined>;
  getWhatsappMessageByMessageId(userId: number, messageId: string): Promise<WhatsappMessage | undefined>;
  getWhatsappMessages(userId: number, contactId: number, limit?: number): Promise<WhatsappMessage[]>;
  createWhatsappMessage(message: InsertWhatsappMessage & { userId: number; contactId: number }): Promise<WhatsappMessage>;
  updateWhatsappMessage(id: number, messageData: Partial<InsertWhatsappMessage>): Promise<WhatsappMessage | undefined>;
  
  // Server methods
  getServerById(id: number): Promise<Server | undefined>;
  getServersByProvider(provider: string): Promise<Server[]>;
  getAllServers(): Promise<Server[]>;
  getActiveServers(): Promise<Server[]>;
  createServer(serverData: InsertServer): Promise<Server>;
  updateServer(id: number, serverData: Partial<InsertServer>): Promise<Server | undefined>;
  deleteServer(id: number): Promise<boolean>;
  countUsersByServer(): Promise<{ serverId: number; userCount: number }[]>;
  
  // UserServer methods
  getUserServers(userId: number): Promise<(Server & { id: number })[]>;
  addUserServer(userId: number, serverId: number): Promise<UserServer | undefined>;
  removeUserServer(userId: number, serverId: number): Promise<boolean>;
  getUserServerRelationById(relationId: number): Promise<UserServer | undefined>;
  getUserServerRelationsByUserId(userId: number): Promise<UserServer[]>;
  removeUserServerRelation(relationId: number): Promise<boolean>;
  getServerWithLeastUsers(onlyActive?: boolean): Promise<Server | undefined>;
  updateUserServerId(userId: number, serverId: number): Promise<User | undefined>;
  getServerUsers(serverId: number): Promise<(UserServer & { user: Partial<SelectUser> })[]>;
  
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
  private leadInteractions: Map<number, LeadInteraction>;
  private leadRecommendations: Map<number, LeadRecommendation>;
  private prospectingSearches: Map<number, ProspectingSearch>;
  private prospectingResults: Map<number, ProspectingResult>;
  private prospectingSchedules: Map<number, any>;
  private prospectingDispatchHistory: Map<number, any>;
  private messageTemplates: Map<number, MessageTemplate>;
  private messageSendings: Map<number, MessageSending>;
  private messageSendingHistory: Map<number, MessageSendingHistory>;
  private whatsappContacts: Map<number, WhatsappContact>;
  private whatsappMessages: Map<number, WhatsappMessage>;
  private servers: Map<number, Server>;
  private userServers: Map<number, UserServer>;
  
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
    this.leadInteractions = new Map();
    this.leadRecommendations = new Map();
    this.prospectingSearches = new Map();
    this.prospectingResults = new Map();
    this.prospectingSchedules = new Map();
    this.prospectingDispatchHistory = new Map();
    this.messageTemplates = new Map();
    this.messageSendings = new Map();
    this.messageSendingHistory = new Map();
    this.whatsappContacts = new Map();
    this.whatsappMessages = new Map();
    this.servers = new Map();
    this.userServers = new Map();
    
    this.currentId = {
      users: 1,
      leads: 1,
      prospects: 1,
      dispatches: 1,
      settings: 1,
      metrics: 1,
      aiAgents: 1,
      leadInteractions: 1,
      leadRecommendations: 1,
      prospectingSearches: 1,
      prospectingResults: 1,
      prospectingSchedules: 1,
      prospectingDispatchHistory: 1,
      messageTemplates: 1,
      messageSendings: 1,
      messageSendingHistory: 1,
      whatsappContacts: 1,
      whatsappMessages: 1,
      servers: 1,
      userServers: 1
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
  
  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }
  
  async deleteUser(id: number): Promise<boolean> {
    if (!this.users.has(id)) return false;
    
    // Delete the user
    this.users.delete(id);
    
    // Delete related data
    // Settings
    const settings = await this.getSettingsByUserId(id);
    if (settings) {
      this.settings.delete(settings.id);
    }
    
    // Leads
    const leads = await this.getLeadsByUserId(id);
    for (const lead of leads) {
      this.leads.delete(lead.id);
    }
    
    // Prospects
    const prospects = await this.getProspectsByUserId(id);
    for (const prospect of prospects) {
      this.prospects.delete(prospect.id);
    }
    
    // Dispatches
    const dispatches = await this.getDispatchesByUserId(id);
    for (const dispatch of dispatches) {
      this.dispatches.delete(dispatch.id);
    }
    
    // AI Agent
    const aiAgent = await this.getAiAgentByUserId(id);
    if (aiAgent) {
      this.aiAgents.delete(aiAgent.id);
    }
    
    // AI Agent Steps
    const aiAgentSteps = await this.getAiAgentSteps(id);
    for (const step of aiAgentSteps) {
      this.aiAgentSteps.delete(step.id);
    }
    
    // AI Agent FAQs
    const aiAgentFaqs = await this.getAiAgentFaqs(id);
    for (const faq of aiAgentFaqs) {
      this.aiAgentFaqs.delete(faq.id);
    }
    
    // Message Templates
    const messageTemplates = await this.getMessageTemplates(id);
    for (const template of messageTemplates) {
      this.messageTemplates.delete(template.id);
    }
    
    // Message Sendings e History
    const messageSendings = await this.getMessageSendings(id);
    for (const sending of messageSendings) {
      const history = await this.getMessageSendingHistory(sending.id);
      for (const entry of history) {
        this.messageSendingHistory.delete(entry.id);
      }
      this.messageSendings.delete(sending.id);
    }
    
    // WhatsApp Contacts e Messages
    const whatsappContacts = await this.getWhatsappContacts(id);
    for (const contact of whatsappContacts) {
      // Remover mensagens do contato
      const messages = await this.getWhatsappMessages(id, contact.id);
      for (const message of messages) {
        this.whatsappMessages.delete(message.id);
      }
      // Remover o contato
      this.whatsappContacts.delete(contact.id);
    }
    
    return true;
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
      scheduledFor: dispatch.scheduledFor || null,
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
  

  


  // Lead Interactions methods
  async getLeadInteractions(leadId: number): Promise<LeadInteraction[]> {
    return Array.from(this.leadInteractions.values())
      .filter(interaction => interaction.leadId === leadId)
      .sort((a, b) => {
        const dateA = a.timestamp instanceof Date ? a.timestamp : new Date(a.timestamp || 0);
        const dateB = b.timestamp instanceof Date ? b.timestamp : new Date(b.timestamp || 0);
        return dateB.getTime() - dateA.getTime();
      });
  }

  async createLeadInteraction(interaction: InsertLeadInteraction & { userId: number }): Promise<LeadInteraction> {
    const id = this.currentId.leadInteractions++;
    const now = new Date();
    const newInteraction: LeadInteraction = {
      id,
      leadId: interaction.leadId,
      userId: interaction.userId,
      type: interaction.type,
      timestamp: now,
      metadata: interaction.metadata || null
    };
    
    this.leadInteractions.set(id, newInteraction);
    return newInteraction;
  }

  // Lead Recommendations methods
  async getLeadRecommendations(userId: number, status?: string): Promise<LeadRecommendation[]> {
    let recommendations = Array.from(this.leadRecommendations.values())
      .filter(rec => rec.userId === userId);
    
    if (status) {
      recommendations = recommendations.filter(rec => rec.status === status);
    }
    
    // Sort by score descendente
    return recommendations.sort((a, b) => b.score - a.score);
  }

  async createLeadRecommendation(recommendation: InsertLeadRecommendation & { userId: number }): Promise<LeadRecommendation> {
    const id = this.currentId.leadRecommendations++;
    const now = new Date();
    const newRecommendation: LeadRecommendation = {
      id,
      userId: recommendation.userId,
      leadId: recommendation.leadId,
      score: recommendation.score,
      reason: recommendation.reason,
      status: recommendation.status || 'pendente',
      createdAt: now,
      actedAt: null
    };
    
    this.leadRecommendations.set(id, newRecommendation);
    return newRecommendation;
  }

  async updateLeadRecommendationStatus(id: number, status: string): Promise<LeadRecommendation | undefined> {
    const recommendation = this.leadRecommendations.get(id);
    if (!recommendation) return undefined;
    
    const now = new Date();
    const updatedRecommendation: LeadRecommendation = {
      ...recommendation,
      status,
      actedAt: now
    };
    
    this.leadRecommendations.set(id, updatedRecommendation);
    return updatedRecommendation;
  }

  /**
   * Gera recomendações de leads com base em interações anteriores
   * O algoritmo considera:
   * 1. Frequência e tipo de interações
   * 2. Interações recentes têm mais peso
   * 3. Engajamento do lead (respostas, cliques, etc.)
   */
  async generateLeadRecommendations(userId: number): Promise<LeadRecommendation[]> {
    // Obter todos os leads do usuário
    const leads = await this.getLeadsByUserId(userId);
    
    // Pesos para diferentes tipos de interações
    const interactionWeights: Record<string, number> = {
      'click': 5,
      'email_open': 10,
      'email_reply': 30,
      'whatsapp_reply': 35,
      'meeting_scheduled': 50,
      'meeting_attended': 70,
      'document_download': 25,
      'form_submission': 40
    };
    
    // Calcular score para cada lead
    const recommendations: LeadRecommendation[] = [];
    
    for (const lead of leads) {
      // Pular leads que já são prospects
      if (lead.status === 'convertido') continue;
      
      // Obter interações para este lead
      const interactions = await this.getLeadInteractions(lead.id);
      
      if (interactions.length === 0) {
        // Se não há interações, cria uma recomendação de baixa prioridade
        recommendations.push(await this.createLeadRecommendation({
          userId,
          leadId: lead.id,
          score: 10,
          reason: 'Lead sem interações recentes. Considere uma abordagem inicial.',
          status: 'pendente'
        }));
        continue;
      }
      
      // Calcular pontuação com base em interações
      let score = 0;
      let mostRecentInteractionDate = new Date(0);
      
      for (const interaction of interactions) {
        const interactionDate = interaction.timestamp instanceof Date ? 
          interaction.timestamp : 
          new Date(interaction.timestamp || 0);
        
        // Atualizar a data da interação mais recente
        if (interactionDate > mostRecentInteractionDate) {
          mostRecentInteractionDate = interactionDate;
        }
        
        // Aplicar peso com base no tipo de interação
        const weight = interactionWeights[interaction.type] || 5;
        
        // Ajustar peso com base na idade da interação (interações mais recentes têm mais valor)
        const daysAgo = Math.floor((Date.now() - interactionDate.getTime()) / (1000 * 60 * 60 * 24));
        const timeMultiplier = Math.max(0.1, 1 - (daysAgo / 30)); // Redução linear ao longo de 30 dias
        
        score += weight * timeMultiplier;
      }
      
      // Normalizar pontuação (0-100)
      score = Math.min(100, Math.round(score));
      
      // Determinar a razão para a recomendação
      let reason = '';
      
      if (score >= 80) {
        reason = 'Lead de alta prioridade com engajamento significativo recente.';
      } else if (score >= 50) {
        reason = 'Lead com bom nível de engajamento. Considere fazer um seguimento.';
      } else if (score >= 30) {
        reason = 'Lead com engajamento moderado. Pode responder bem a uma nova abordagem.';
      } else {
        reason = 'Lead com pouco engajamento. Considere uma estratégia de reativação.';
      }
      
      // Adicionar detalhes da interação mais recente
      const daysSinceLastInteraction = Math.floor((Date.now() - mostRecentInteractionDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceLastInteraction <= 7) {
        reason += ` Última interação há ${daysSinceLastInteraction} dias.`;
      } else if (daysSinceLastInteraction <= 30) {
        reason += ` Sem interações nas últimas ${daysSinceLastInteraction} dias.`;
      } else {
        reason += ' Sem interações recentes.';
      }
      
      // Criar recomendação
      recommendations.push(await this.createLeadRecommendation({
        userId,
        leadId: lead.id,
        score,
        reason,
        status: 'pendente'
      }));
    }
    
    return recommendations.sort((a, b) => b.score - a.score);
  }
  
  // Prospecting Searches methods
  async getProspectingSearches(userId: number): Promise<ProspectingSearch[]> {
    return Array.from(this.prospectingSearches.values())
      .filter(search => search.userId === userId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }
  
  async getProspectingSearch(id: number): Promise<ProspectingSearch | undefined> {
    return this.prospectingSearches.get(id);
  }
  
  async createProspectingSearch(searchData: InsertProspectingSearch & { userId: number }): Promise<ProspectingSearch> {
    const id = this.currentId.prospectingSearches++;
    const now = new Date();
    
    const search: ProspectingSearch = {
      id,
      userId: searchData.userId,
      segment: searchData.segment,
      city: searchData.city || null,
      filters: searchData.filters || null,
      status: searchData.status || "pendente",
      createdAt: now,
      completedAt: null,
      leadsFound: searchData.leadsFound || 0,
      dispatchesDone: searchData.dispatchesDone || 0,
      dispatchesPending: searchData.dispatchesPending || 0,
      webhookUrl: searchData.webhookUrl || null
    };
    
    this.prospectingSearches.set(id, search);
    return search;
  }
  
  async updateProspectingSearch(id: number, searchData: Partial<InsertProspectingSearch>): Promise<ProspectingSearch | undefined> {
    const search = await this.getProspectingSearch(id);
    if (!search) return undefined;
    
    const updatedSearch = { ...search, ...searchData };
    
    // If status changed to 'concluido', set completedAt
    if (searchData.status === 'concluido' && search.status !== 'concluido') {
      updatedSearch.completedAt = new Date();
    }
    
    this.prospectingSearches.set(id, updatedSearch);
    return updatedSearch;
  }
  
  async deleteProspectingSearch(id: number): Promise<boolean> {
    // Delete all results associated with this search
    const resultsToDelete = Array.from(this.prospectingResults.values())
      .filter(result => result.searchId === id);
    
    for (const result of resultsToDelete) {
      this.prospectingResults.delete(result.id);
    }
    
    // Delete the search
    if (!this.prospectingSearches.has(id)) return false;
    return this.prospectingSearches.delete(id);
  }
  
  // Prospecting Results methods
  async getProspectingResults(searchId: number): Promise<ProspectingResult[]> {
    return Array.from(this.prospectingResults.values())
      .filter(result => result.searchId === searchId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }
  
  async getProspectingResult(id: number): Promise<ProspectingResult | undefined> {
    return this.prospectingResults.get(id);
  }
  
  async createProspectingResult(resultData: InsertProspectingResult & { searchId: number }): Promise<ProspectingResult> {
    const id = this.currentId.prospectingResults++;
    const now = new Date();
    
    const result: ProspectingResult = {
      id,
      searchId: resultData.searchId,
      name: resultData.name || null,
      phone: resultData.phone || null,
      email: resultData.email || null,
      address: resultData.address || null,
      type: resultData.type || null,
      createdAt: now,
      dispatchedAt: null
    };
    
    this.prospectingResults.set(id, result);
    return result;
  }
  
  async updateProspectingResult(id: number, resultData: Partial<InsertProspectingResult>): Promise<ProspectingResult | undefined> {
    const result = await this.getProspectingResult(id);
    if (!result) return undefined;
    
    const updatedResult = { ...result, ...resultData };
    this.prospectingResults.set(id, updatedResult);
    return updatedResult;
  }
  
  async deleteProspectingResult(id: number): Promise<boolean> {
    if (!this.prospectingResults.has(id)) return false;
    return this.prospectingResults.delete(id);
  }
  
  // Prospecting Schedules methods
  async getProspectingSchedules(searchId: number): Promise<any[]> {
    return Array.from(this.prospectingSchedules.values()).filter(schedule => schedule.searchId === searchId);
  }
  
  async createProspectingSchedule(scheduleData: any): Promise<any> {
    const id = this.currentId.prospectingSchedules++;
    const now = new Date();
    const schedule = {
      ...scheduleData,
      id,
      createdAt: now
    };
    this.prospectingSchedules.set(id, schedule);
    return schedule;
  }
  
  // Prospecting Dispatch History methods
  async getProspectingDispatchHistory(searchId: number): Promise<any[]> {
    return Array.from(this.prospectingDispatchHistory.values()).filter(history => history.searchId === searchId);
  }
  
  async createProspectingDispatchHistory(historyData: any): Promise<any> {
    const id = this.currentId.prospectingDispatchHistory++;
    const now = new Date();
    const history = {
      ...historyData,
      id,
      executedAt: historyData.executedAt || now
    };
    this.prospectingDispatchHistory.set(id, history);
    return history;
  }
  
  async updateProspectingDispatchHistory(id: number, historyData: any): Promise<any> {
    const history = this.prospectingDispatchHistory.get(id);
    if (!history) return undefined;
    
    const updatedHistory = { ...history, ...historyData };
    this.prospectingDispatchHistory.set(id, updatedHistory);
    return updatedHistory;
  }
  
  // Message Template methods
  async getMessageTemplates(userId: number): Promise<MessageTemplate[]> {
    return Array.from(this.messageTemplates.values()).filter(template => template.userId === userId);
  }
  
  async getMessageTemplate(id: number): Promise<MessageTemplate | undefined> {
    return this.messageTemplates.get(id);
  }
  
  async createMessageTemplate(template: InsertMessageTemplate & { userId: number }): Promise<MessageTemplate> {
    const id = this.currentId.messageTemplates++;
    const now = new Date();
    const newTemplate: MessageTemplate = {
      ...template,
      id,
      createdAt: now,
      updatedAt: now,
      tags: template.tags || null
    };
    this.messageTemplates.set(id, newTemplate);
    return newTemplate;
  }
  
  async updateMessageTemplate(id: number, templateData: Partial<InsertMessageTemplate>): Promise<MessageTemplate | undefined> {
    const template = await this.getMessageTemplate(id);
    if (!template) return undefined;
    
    const now = new Date();
    const updatedTemplate = {
      ...template,
      ...templateData,
      updatedAt: now
    };
    this.messageTemplates.set(id, updatedTemplate);
    return updatedTemplate;
  }
  
  async deleteMessageTemplate(id: number): Promise<boolean> {
    if (!this.messageTemplates.has(id)) return false;
    this.messageTemplates.delete(id);
    return true;
  }
  
  // Message Sending methods
  async getMessageSendings(userId: number): Promise<MessageSending[]> {
    return Array.from(this.messageSendings.values()).filter(sending => sending.userId === userId);
  }
  
  async getMessageSending(id: number): Promise<MessageSending | undefined> {
    return this.messageSendings.get(id);
  }
  
  async createMessageSending(sending: InsertMessageSending & { userId: number }): Promise<MessageSending> {
    const id = this.currentId.messageSendings++;
    const now = new Date();
    const newSending: MessageSending = {
      ...sending,
      id,
      createdAt: now,
      updatedAt: now,
      searchId: sending.searchId || null,
      templateId: sending.templateId || null,
      customMessage: sending.customMessage || null,
      quantity: sending.quantity || 10,
      scheduledAt: sending.scheduledAt || null,
      executedAt: null,
      status: sending.status || "agendado",
      aiLearningEnabled: sending.aiLearningEnabled || false,
      aiNotes: sending.aiNotes || null
    };
    this.messageSendings.set(id, newSending);
    return newSending;
  }
  
  async updateMessageSending(id: number, sendingData: Partial<InsertMessageSending>): Promise<MessageSending | undefined> {
    const sending = await this.getMessageSending(id);
    if (!sending) return undefined;
    
    const now = new Date();
    const updatedSending = {
      ...sending,
      ...sendingData,
      updatedAt: now
    };
    this.messageSendings.set(id, updatedSending);
    return updatedSending;
  }
  
  async deleteMessageSending(id: number): Promise<boolean> {
    if (!this.messageSendings.has(id)) return false;
    this.messageSendings.delete(id);
    return true;
  }
  
  // Message Sending History methods
  async getMessageSendingHistory(sendingId: number): Promise<MessageSendingHistory[]> {
    return Array.from(this.messageSendingHistory.values()).filter(history => history.sendingId === sendingId);
  }
  
  async createMessageSendingHistory(history: InsertMessageSendingHistory): Promise<MessageSendingHistory> {
    const id = this.currentId.messageSendingHistory++;
    const now = new Date();
    const newHistory: MessageSendingHistory = {
      ...history,
      id,
      sentAt: now,
      resultId: history.resultId || null,
      status: history.status || "sucesso",
      errorMessage: history.errorMessage || null
    };
    this.messageSendingHistory.set(id, newHistory);
    return newHistory;
  }
  
  // WhatsApp Contacts methods
  async getWhatsappContact(id: number): Promise<WhatsappContact | undefined> {
    return this.whatsappContacts.get(id);
  }

  async getWhatsappContactByContactId(userId: number, contactId: string): Promise<WhatsappContact | undefined> {
    return Array.from(this.whatsappContacts.values()).find(
      contact => contact.userId === userId && contact.contactId === contactId
    );
  }

  async getWhatsappContacts(userId: number): Promise<WhatsappContact[]> {
    return Array.from(this.whatsappContacts.values()).filter(
      contact => contact.userId === userId
    );
  }

  async createWhatsappContact(contact: InsertWhatsappContact & { userId: number }): Promise<WhatsappContact> {
    const id = this.currentId.whatsappContacts++;
    const now = new Date();
    const newContact: WhatsappContact = {
      id,
      userId: contact.userId,
      contactId: contact.contactId,
      name: contact.name || null,
      number: contact.number,
      profilePicture: contact.profilePicture || null,
      isGroup: contact.isGroup || false,
      lastActivity: contact.lastActivity || null,
      lastMessageContent: contact.lastMessageContent || null,
      unreadCount: contact.unreadCount || 0,
      createdAt: now,
      updatedAt: now,
    };
    this.whatsappContacts.set(id, newContact);
    return newContact;
  }

  async updateWhatsappContact(id: number, contactData: Partial<InsertWhatsappContact>): Promise<WhatsappContact | undefined> {
    const contact = await this.getWhatsappContact(id);
    if (!contact) return undefined;
    
    const now = new Date();
    const updatedContact = { 
      ...contact, 
      ...contactData,
      updatedAt: now
    };
    this.whatsappContacts.set(id, updatedContact);
    return updatedContact;
  }

  // WhatsApp Messages methods
  async getWhatsappMessage(id: number): Promise<WhatsappMessage | undefined> {
    return this.whatsappMessages.get(id);
  }

  async getWhatsappMessageByMessageId(userId: number, messageId: string): Promise<WhatsappMessage | undefined> {
    return Array.from(this.whatsappMessages.values()).find(
      message => message.userId === userId && message.messageId === messageId
    );
  }

  async getWhatsappMessages(userId: number, contactId: number, limit?: number): Promise<WhatsappMessage[]> {
    const messages = Array.from(this.whatsappMessages.values())
      .filter(message => message.userId === userId && message.contactId === contactId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    return limit ? messages.slice(0, limit) : messages;
  }

  async createWhatsappMessage(message: InsertWhatsappMessage & { userId: number; contactId: number }): Promise<WhatsappMessage> {
    const id = this.currentId.whatsappMessages++;
    const now = new Date();
    
    const newMessage: WhatsappMessage = {
      id,
      userId: message.userId,
      contactId: message.contactId,
      messageId: message.messageId,
      content: message.content || null,
      fromMe: message.fromMe || false,
      timestamp: message.timestamp || now,
      mediaType: message.mediaType || null,
      mediaUrl: message.mediaUrl || null,
      isRead: message.isRead || false,
      createdAt: now,
    };
    
    this.whatsappMessages.set(id, newMessage);
    
    // Atualizar o contato com a última mensagem
    if (message.content) {
      const contact = await this.getWhatsappContact(message.contactId);
      if (contact) {
        await this.updateWhatsappContact(contact.id, {
          lastMessageContent: message.content,
          lastActivity: now,
          unreadCount: message.fromMe ? contact.unreadCount : (contact.unreadCount || 0) + 1
        });
      }
    }
    
    return newMessage;
  }

  async updateWhatsappMessage(id: number, messageData: Partial<InsertWhatsappMessage>): Promise<WhatsappMessage | undefined> {
    const message = await this.getWhatsappMessage(id);
    if (!message) return undefined;
    
    const updatedMessage = { ...message, ...messageData };
    this.whatsappMessages.set(id, updatedMessage);
    return updatedMessage;
  }
  
  // Server methods
  async getServerById(id: number): Promise<Server | undefined> {
    return this.servers.get(id);
  }

  async getServersByProvider(provider: string): Promise<Server[]> {
    return Array.from(this.servers.values()).filter(server => server.provider === provider);
  }

  async getAllServers(): Promise<Server[]> {
    return Array.from(this.servers.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  async getActiveServers(): Promise<Server[]> {
    return Array.from(this.servers.values())
      .filter(server => server.active)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async createServer(serverData: InsertServer): Promise<Server> {
    const id = this.currentId.servers++;
    const now = new Date();
    const server: Server = {
      ...serverData,
      id,
      createdAt: now,
      updatedAt: now,
      active: serverData.active !== undefined ? serverData.active : true
    };
    this.servers.set(id, server);
    return server;
  }

  async updateServer(id: number, serverData: Partial<InsertServer>): Promise<Server | undefined> {
    const existingServer = this.servers.get(id);
    if (!existingServer) return undefined;
    
    const updatedServer = { 
      ...existingServer, 
      ...serverData,
      updatedAt: new Date()
    };
    this.servers.set(id, updatedServer);
    return updatedServer;
  }

  async deleteServer(id: number): Promise<boolean> {
    if (!this.servers.has(id)) return false;
    
    // Primeiro remover as associações com usuários
    const userServers = Array.from(this.userServers.values()).filter(us => us.serverId === id);
    for (const userServer of userServers) {
      this.userServers.delete(userServer.id);
    }
    
    // Depois remover o servidor
    this.servers.delete(id);
    return true;
  }

  // UserServer methods
  async getUserServers(userId: number): Promise<any[]> {
    try {
      console.log(`Buscando relações de servidor para o usuário ${userId}`);
      
      // Obter todas as relações deste usuário com servidores
      const relations = await db
        .select()
        .from(userServers)
        .where(eq(userServers.userId, userId));
        
      console.log(`Encontradas ${relations.length} relações para o usuário ${userId}`);
      
      if (!relations || relations.length === 0) {
        return [];
      }
      
      // Obter IDs dos servidores
      const serverIds = relations.map(r => r.serverId);
      
      // Verificar se há IDs para buscar
      if (serverIds.length === 0) {
        return [];
      }
      
      // Buscar informações completas de cada servidor individualmente
      // para evitar problemas com o inArray em alguns casos
      const serverList: any[] = [];
      for (const serverId of serverIds) {
        try {
          const server = await db
            .select()
            .from(servers)
            .where(eq(servers.id, serverId))
            .limit(1);
            
          if (server && server.length > 0) {
            serverList.push(server[0]);
          }
        } catch (serverErr) {
          console.error(`Erro ao buscar servidor ${serverId}:`, serverErr);
        }
      }
      
      console.log(`Servidores encontrados: ${serverList.length}`);
      
      // Combinar relações com servidores
      const result = relations.map(relation => {
        const serverInfo = serverList.find(s => s.id === relation.serverId);
        return {
          ...relation,
          server: serverInfo || null
        };
      });
      
      return result;
    } catch (error) {
      console.error(`Erro ao buscar servidores do usuário ${userId}:`, error);
      return [];
    }
  }

  async addUserServer(userId: number, serverId: number): Promise<UserServer | undefined> {
    if (!this.users.has(userId) || !this.servers.has(serverId)) {
      return undefined;
    }
    
    const id = this.currentId.userServers++;
    const now = new Date();
    const userServer: UserServer = {
      id,
      userId,
      serverId,
      createdAt: now
    };
    this.userServers.set(id, userServer);
    return userServer;
  }

  async removeUserServer(userId: number, serverId: number): Promise<boolean> {
    const userServer = Array.from(this.userServers.values()).find(
      us => us.userId === userId && us.serverId === serverId
    );
    
    if (!userServer) return false;
    
    this.userServers.delete(userServer.id);
    return true;
  }
  
  async getUserServerRelationById(relationId: number): Promise<UserServer | undefined> {
    return this.userServers.get(relationId);
  }
  
  async getUserServerRelationsByUserId(userId: number): Promise<UserServer[]> {
    return Array.from(this.userServers.values())
      .filter(relation => relation.userId === userId);
  }
  
  async removeUserServerRelation(relationId: number): Promise<boolean> {
    if (!this.userServers.has(relationId)) return false;
    
    this.userServers.delete(relationId);
    return true;
  }
  
  async updateUserServerId(userId: number, serverId: number): Promise<User | undefined> {
    const user = await this.getUser(userId);
    if (!user) return undefined;
    
    const server = await this.getServerById(serverId);
    if (!server) return undefined;
    
    const updatedUser = { ...user, serverId };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }
  
  async getServerUsers(serverId: number): Promise<(UserServer & { user: Partial<SelectUser> })[]> {
    // Filtrar as relações usuário-servidor para o servidor específico
    const relations = Array.from(this.userServers.values()).filter(
      rel => rel.serverId === serverId
    );
    
    if (!relations || relations.length === 0) {
      return [];
    }
    
    // Buscar informações completas de cada usuário
    const userDetails = await Promise.all(
      relations.map(async (relation) => {
        const user = await this.getUser(relation.userId);
        
        return {
          ...relation,
          user: user ? {
            id: user.id,
            name: user.name,
            username: user.username,
            email: user.email
          } : null
        };
      })
    );
    
    return userDetails;
  }
  
  async countUsersByServer(): Promise<{ serverId: number; userCount: number }[]> {
    // Contar usuários por servidor
    const serverCounts = new Map<number, number>();
    
    // Iterar sobre todas as relações usuário-servidor
    Array.from(this.userServers.values()).forEach(relation => {
      const serverId = relation.serverId;
      const currentCount = serverCounts.get(serverId) || 0;
      serverCounts.set(serverId, currentCount + 1);
    });
    
    // Converter o Map para o formato de array de objetos
    return Array.from(serverCounts.entries()).map(([serverId, userCount]) => ({
      serverId,
      userCount
    }));
  }
  
  async getServerWithLeastUsers(onlyActive: boolean = true): Promise<Server | undefined> {
    // Obter todos os servidores (ativos, se especificado)
    const serversList = onlyActive 
      ? Array.from(this.servers.values()).filter(server => server.active)
      : Array.from(this.servers.values());
    
    if (serversList.length === 0) return undefined;
    
    // Obter contagem de usuários por servidor
    const userCountMap = await this.countUsersByServer();
    
    // Encontrar o servidor que está mais próximo de atingir sua capacidade máxima (menor disponibilidade proporcional)
    let bestServer: Server | undefined = undefined;
    let highestUtilizationRatio = -1; // Começamos com -1 para garantir que qualquer razão positiva seja maior
    
    for (const server of serversList) {
      const userCount = userCountMap.find(uc => uc.serverId === server.id)?.userCount || 0;
      const maxUsers = server.maxUsers || 10; // Default de 10 se não especificado
      
      // Calcular a razão de utilização (quanto maior, mais próximo de estar cheio)
      const utilizationRatio = userCount / maxUsers;
      
      // Verificar se o servidor ainda tem capacidade disponível e se tem uma taxa de utilização maior
      if (userCount < maxUsers && utilizationRatio > highestUtilizationRatio) {
        highestUtilizationRatio = utilizationRatio;
        bestServer = server;
      }
    }
    
    console.log(`Selecionado servidor com maior taxa de utilização: ${bestServer?.name} (${highestUtilizationRatio.toFixed(2)})`);
    return bestServer;
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
  
  // AI Agent methods (consolidated)
  async getAiAgent(userId: number): Promise<AiAgent | undefined> {
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
  
  async updateAiAgent(id: number, agentData: Partial<InsertAiAgent>): Promise<AiAgent | undefined> {
    const [updatedAgent] = await db
      .update(aiAgent)
      .set(agentData)
      .where(eq(aiAgent.id, id))
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
  
  // Lead Interactions methods
  async getLeadInteractions(leadId: number): Promise<LeadInteraction[]> {
    return db
      .select()
      .from(leadInteractions)
      .where(eq(leadInteractions.leadId, leadId))
      .orderBy(desc(leadInteractions.timestamp));
  }

  async createLeadInteraction(interaction: InsertLeadInteraction & { userId: number }): Promise<LeadInteraction> {
    const [newInteraction] = await db
      .insert(leadInteractions)
      .values(interaction)
      .returning();
    return newInteraction;
  }

  // Lead Recommendations methods
  async getLeadRecommendations(userId: number, status?: string): Promise<LeadRecommendation[]> {
    let query = db
      .select()
      .from(leadRecommendations)
      .where(eq(leadRecommendations.userId, userId));
    
    if (status) {
      return db
        .select()
        .from(leadRecommendations)
        .where(and(
          eq(leadRecommendations.userId, userId),
          eq(leadRecommendations.status, status)
        ))
        .orderBy(desc(leadRecommendations.score));
    }
    
    return query.orderBy(desc(leadRecommendations.score));
  }

  async createLeadRecommendation(recommendation: InsertLeadRecommendation & { userId: number }): Promise<LeadRecommendation> {
    const [newRecommendation] = await db
      .insert(leadRecommendations)
      .values(recommendation)
      .returning();
    return newRecommendation;
  }

  async updateLeadRecommendationStatus(id: number, status: string): Promise<LeadRecommendation | undefined> {
    const now = new Date();
    const [updatedRecommendation] = await db
      .update(leadRecommendations)
      .set({ status, actedAt: now })
      .where(eq(leadRecommendations.id, id))
      .returning();
    return updatedRecommendation;
  }

  async generateLeadRecommendations(userId: number): Promise<LeadRecommendation[]> {
    // Obter todos os leads do usuário
    const userLeads = await this.getLeadsByUserId(userId);
    
    // Pesos para diferentes tipos de interações
    const interactionWeights: Record<string, number> = {
      'click': 5,
      'email_open': 10,
      'email_reply': 30,
      'whatsapp_reply': 35,
      'meeting_scheduled': 50,
      'meeting_attended': 70,
      'document_download': 25,
      'form_submission': 40
    };
    
    // Array para armazenar as recomendações geradas
    const recommendations: LeadRecommendation[] = [];
    
    for (const lead of userLeads) {
      // Pular leads que já são prospects
      if (lead.status === 'convertido') continue;
      
      // Obter interações para este lead
      const interactions = await this.getLeadInteractions(lead.id);
      
      if (interactions.length === 0) {
        // Se não há interações, cria uma recomendação de baixa prioridade
        const newRecommendation = await this.createLeadRecommendation({
          userId,
          leadId: lead.id,
          score: 10,
          reason: 'Lead sem interações recentes. Considere uma abordagem inicial.',
          status: 'pendente'
        });
        recommendations.push(newRecommendation);
        continue;
      }
      
      // Calcular pontuação com base em interações
      let score = 0;
      let mostRecentInteractionDate = new Date(0);
      
      for (const interaction of interactions) {
        const interactionDate = interaction.timestamp instanceof Date ? 
          interaction.timestamp : 
          new Date(interaction.timestamp || 0);
        
        // Atualizar a data da interação mais recente
        if (interactionDate > mostRecentInteractionDate) {
          mostRecentInteractionDate = interactionDate;
        }
        
        // Aplicar peso com base no tipo de interação
        const weight = interactionWeights[interaction.type] || 5;
        
        // Ajustar peso com base na idade da interação
        const daysAgo = Math.floor((Date.now() - interactionDate.getTime()) / (1000 * 60 * 60 * 24));
        const timeMultiplier = Math.max(0.1, 1 - (daysAgo / 30)); // Redução linear ao longo de 30 dias
        
        score += weight * timeMultiplier;
      }
      
      // Normalizar pontuação (0-100)
      score = Math.min(100, Math.round(score));
      
      // Determinar a razão para a recomendação
      let reason = '';
      
      if (score >= 80) {
        reason = 'Lead de alta prioridade com engajamento significativo recente.';
      } else if (score >= 50) {
        reason = 'Lead com bom nível de engajamento. Considere fazer um seguimento.';
      } else if (score >= 30) {
        reason = 'Lead com engajamento moderado. Pode responder bem a uma nova abordagem.';
      } else {
        reason = 'Lead com pouco engajamento. Considere uma estratégia de reativação.';
      }
      
      // Adicionar detalhes sobre a última interação
      const daysSinceLastInteraction = Math.floor((Date.now() - mostRecentInteractionDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceLastInteraction <= 7) {
        reason += ` Última interação há ${daysSinceLastInteraction} dias.`;
      } else if (daysSinceLastInteraction <= 30) {
        reason += ` Sem interações nas últimas ${daysSinceLastInteraction} dias.`;
      } else {
        reason += ' Sem interações recentes.';
      }
      
      // Criar recomendação
      const newRecommendation = await this.createLeadRecommendation({
        userId,
        leadId: lead.id,
        score,
        reason,
        status: 'pendente'
      });
      recommendations.push(newRecommendation);
    }
    
    return recommendations;
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
  
  // Prospecting Searches methods
  async getProspectingSearches(userId: number): Promise<ProspectingSearch[]> {
    return db
      .select()
      .from(prospectingSearches)
      .where(eq(prospectingSearches.userId, userId))
      .orderBy(desc(prospectingSearches.createdAt));
  }
  
  async getProspectingSearch(id: number): Promise<ProspectingSearch | undefined> {
    const [search] = await db
      .select()
      .from(prospectingSearches)
      .where(eq(prospectingSearches.id, id));
    return search;
  }
  
  async createProspectingSearch(searchData: InsertProspectingSearch & { userId: number }): Promise<ProspectingSearch> {
    const [newSearch] = await db
      .insert(prospectingSearches)
      .values(searchData)
      .returning();
    return newSearch;
  }
  
  async updateProspectingSearch(id: number, searchData: Partial<InsertProspectingSearch>): Promise<ProspectingSearch | undefined> {
    let updateData = {...searchData};
    
    // Check if we need to set completedAt
    if (searchData.status === 'concluido') {
      const [currentSearch] = await db
        .select()
        .from(prospectingSearches)
        .where(eq(prospectingSearches.id, id));
      
      if (currentSearch && currentSearch.status !== 'concluido') {
        updateData.completedAt = new Date();
      }
    }
    
    const [updatedSearch] = await db
      .update(prospectingSearches)
      .set(updateData)
      .where(eq(prospectingSearches.id, id))
      .returning();
    return updatedSearch;
  }
  
  async deleteProspectingSearch(id: number): Promise<boolean> {
    // Delete associated results first
    await db
      .delete(prospectingResults)
      .where(eq(prospectingResults.searchId, id));
    
    // Then delete the search
    const result = await db
      .delete(prospectingSearches)
      .where(eq(prospectingSearches.id, id));
    return !!result;
  }
  
  // Prospecting Results methods
  async getProspectingResults(searchId: number): Promise<ProspectingResult[]> {
    try {
      const results = await db
        .select({
          id: prospectingResults.id,
          searchId: prospectingResults.searchId,
          name: prospectingResults.name,
          phone: prospectingResults.phone,
          email: prospectingResults.email,
          address: prospectingResults.address,
          type: prospectingResults.type,
          site: prospectingResults.site,
          cidade: prospectingResults.cidade,
          estado: prospectingResults.estado,
          createdAt: prospectingResults.createdAt,
          dispatchedAt: prospectingResults.dispatchedAt
        })
        .from(prospectingResults)
        .where(eq(prospectingResults.searchId, searchId))
        .orderBy(desc(prospectingResults.createdAt));
      
      console.log(`Encontrados ${results.length} resultados no banco para a busca ${searchId}`);
      return results;
    } catch (error) {
      console.error("Erro ao buscar resultados de prospecção:", error);
      return [];
    }
  }
  
  async getProspectingResult(id: number): Promise<ProspectingResult | undefined> {
    const [result] = await db
      .select()
      .from(prospectingResults)
      .where(eq(prospectingResults.id, id));
    return result;
  }
  
  async createProspectingResult(resultData: InsertProspectingResult & { searchId: number }): Promise<ProspectingResult> {
    const [newResult] = await db
      .insert(prospectingResults)
      .values(resultData)
      .returning();
    return newResult;
  }
  
  async updateProspectingResult(id: number, resultData: Partial<InsertProspectingResult>): Promise<ProspectingResult | undefined> {
    const [updatedResult] = await db
      .update(prospectingResults)
      .set(resultData)
      .where(eq(prospectingResults.id, id))
      .returning();
    return updatedResult;
  }
  
  async deleteProspectingResult(id: number): Promise<boolean> {
    const result = await db
      .delete(prospectingResults)
      .where(eq(prospectingResults.id, id));
    return !!result;
  }
  
  // Prospecting Schedules methods
  async getProspectingSchedules(searchId: number): Promise<any[]> {
    try {
      return db
        .select()
        .from(prospectingSchedules)
        .where(eq(prospectingSchedules.searchId, searchId))
        .orderBy(desc(prospectingSchedules.createdAt));
    } catch (error) {
      console.error("Erro ao buscar agendamentos:", error);
      return [];
    }
  }
  
  async createProspectingSchedule(scheduleData: any): Promise<any> {
    try {
      const [newSchedule] = await db
        .insert(prospectingSchedules)
        .values(scheduleData)
        .returning();
      return newSchedule;
    } catch (error) {
      console.error("Erro ao criar agendamento:", error);
      throw error;
    }
  }
  
  async updateProspectingSchedule(id: number, data: any): Promise<any> {
    try {
      const [updated] = await db
        .update(prospectingSchedules)
        .set(data)
        .where(eq(prospectingSchedules.id, id))
        .returning();
      return updated;
    } catch (error) {
      console.error("Erro ao atualizar agendamento:", error);
      throw error;
    }
  }
  
  async getProspectingDispatchHistory(searchId: number): Promise<any[]> {
    try {
      return db
        .select()
        .from(prospectingDispatchHistory)
        .where(eq(prospectingDispatchHistory.searchId, searchId))
        .orderBy(desc(prospectingDispatchHistory.executedAt));
    } catch (error) {
      console.error("Erro ao buscar histórico de envios:", error);
      return [];
    }
  }
  
  async createProspectingDispatchHistory(data: any): Promise<any> {
    try {
      const [newRecord] = await db
        .insert(prospectingDispatchHistory)
        .values(data)
        .returning();
      return newRecord;
    } catch (error) {
      console.error("Erro ao registrar histórico de envio:", error);
      throw error;
    }
  }
  
  async updateProspectingDispatchHistory(id: number, historyData: any): Promise<any> {
    try {
      const [updatedRecord] = await db
        .update(prospectingDispatchHistory)
        .set(historyData)
        .where(eq(prospectingDispatchHistory.id, id))
        .returning();
      return updatedRecord;
    } catch (error) {
      console.error("Erro ao atualizar histórico de envio:", error);
      throw error;
    }
  }
  
  async getAllUsers(): Promise<User[]> {
    try {
      const allUsers = await db
        .select()
        .from(users)
        .orderBy(users.id);
      return allUsers;
    } catch (error) {
      console.error('Erro ao buscar todos os usuários:', error);
      return [];
    }
  }
  
  async deleteUser(id: number): Promise<boolean> {
    try {
      // Deletar dados relacionados ao usuário em ordem apropriada devido às chaves estrangeiras
      
      // AI Agent Steps e FAQs
      await db.delete(aiAgentSteps).where(eq(aiAgentSteps.userId, id));
      await db.delete(aiAgentFaqs).where(eq(aiAgentFaqs.userId, id));
      
      // AI Agent
      await db.delete(aiAgent).where(eq(aiAgent.userId, id));
      
      // Lead Interactions e Recommendations
      const userLeads = await db.select().from(leads).where(eq(leads.userId, id));
      for (const lead of userLeads) {
        await db.delete(leadInteractions).where(eq(leadInteractions.leadId, lead.id));
        await db.delete(leadRecommendations).where(eq(leadRecommendations.leadId, lead.id));
      }
      
      await db.delete(leadRecommendations).where(eq(leadRecommendations.userId, id));
      
      // Prospecting Results (precisamos pegar os IDs de busca primeiro)
      const searches = await db.select().from(prospectingSearches).where(eq(prospectingSearches.userId, id));
      for (const search of searches) {
        await db.delete(prospectingResults).where(eq(prospectingResults.searchId, search.id));
      }
      
      // Prospecting Searches
      await db.delete(prospectingSearches).where(eq(prospectingSearches.userId, id));
      
      // Leads, Prospects e Dispatches
      await db.delete(leads).where(eq(leads.userId, id));
      await db.delete(prospects).where(eq(prospects.userId, id));
      await db.delete(dispatches).where(eq(dispatches.userId, id));
      
      // Metrics
      await db.delete(metrics).where(eq(metrics.userId, id));
      
      // Configurações
      await db.delete(settings).where(eq(settings.userId, id));
      
      // Message Templates, Sendings e History
      const sendings = await db.select().from(messageSendings).where(eq(messageSendings.userId, id));
      for (const sending of sendings) {
        await db.delete(messageSendingHistory).where(eq(messageSendingHistory.sendingId, sending.id));
      }
      await db.delete(messageSendings).where(eq(messageSendings.userId, id));
      await db.delete(messageTemplates).where(eq(messageTemplates.userId, id));
      
      // Finalmente, deletar o usuário
      const result = await db.delete(users).where(eq(users.id, id));
      
      return result.length > 0;
    } catch (error) {
      console.error("Erro ao deletar usuário:", error);
      return false;
    }
  }
  
  // Message Template methods
  async getMessageTemplates(userId: number): Promise<MessageTemplate[]> {
    try {
      console.log("DatabaseStorage.getMessageTemplates chamado para usuário:", userId);
      
      // Vamos imprimir a consulta SQL que seria executada
      const query = db
        .select()
        .from(messageTemplates)
        .where(eq(messageTemplates.userId, userId))
        .orderBy(messageTemplates.title);
      
      console.log("Consulta SQL:", query.toSQL().sql);
      console.log("Parâmetros:", query.toSQL().params);
      
      const results = await query;
      console.log("Resultados obtidos:", results.length);
      
      return results;
    } catch (error) {
      console.error("Erro ao buscar templates de mensagens:", error);
      console.error("Detalhes do erro:", JSON.stringify(error, Object.getOwnPropertyNames(error).reduce((acc, key) => {
        acc[key] = (error as any)[key];
        return acc;
      }, {} as any)));
      
      return [];
    }
  }
  
  async getMessageTemplate(id: number): Promise<MessageTemplate | undefined> {
    try {
      const [template] = await db
        .select()
        .from(messageTemplates)
        .where(eq(messageTemplates.id, id));
      return template;
    } catch (error) {
      console.error("Erro ao buscar template de mensagem:", error);
      return undefined;
    }
  }
  
  async createMessageTemplate(template: InsertMessageTemplate & { userId: number }): Promise<MessageTemplate> {
    try {
      const [newTemplate] = await db
        .insert(messageTemplates)
        .values(template)
        .returning();
      return newTemplate;
    } catch (error) {
      console.error("Erro ao criar template de mensagem:", error);
      throw error;
    }
  }
  
  async updateMessageTemplate(id: number, templateData: Partial<InsertMessageTemplate>): Promise<MessageTemplate | undefined> {
    try {
      const [updatedTemplate] = await db
        .update(messageTemplates)
        .set({ ...templateData, updatedAt: new Date() })
        .where(eq(messageTemplates.id, id))
        .returning();
      return updatedTemplate;
    } catch (error) {
      console.error("Erro ao atualizar template de mensagem:", error);
      return undefined;
    }
  }
  
  async deleteMessageTemplate(id: number): Promise<boolean> {
    try {
      const result = await db
        .delete(messageTemplates)
        .where(eq(messageTemplates.id, id));
      return result.length > 0;
    } catch (error) {
      console.error("Erro ao deletar template de mensagem:", error);
      return false;
    }
  }
  
  // Message Sending methods
  async getMessageSendings(userId: number): Promise<MessageSending[]> {
    try {
      return db
        .select()
        .from(messageSendings)
        .where(eq(messageSendings.userId, userId))
        .orderBy(desc(messageSendings.createdAt));
    } catch (error) {
      console.error("Erro ao buscar envios de mensagens:", error);
      return [];
    }
  }
  
  async getMessageSending(id: number): Promise<MessageSending | undefined> {
    try {
      const [sending] = await db
        .select()
        .from(messageSendings)
        .where(eq(messageSendings.id, id));
      return sending;
    } catch (error) {
      console.error("Erro ao buscar envio de mensagem:", error);
      return undefined;
    }
  }
  
  async createMessageSending(sending: InsertMessageSending & { userId: number }): Promise<MessageSending> {
    try {
      const [newSending] = await db
        .insert(messageSendings)
        .values(sending)
        .returning();
      return newSending;
    } catch (error) {
      console.error("Erro ao criar envio de mensagem:", error);
      throw error;
    }
  }
  
  async updateMessageSending(id: number, sendingData: Partial<InsertMessageSending>): Promise<MessageSending | undefined> {
    try {
      const [updatedSending] = await db
        .update(messageSendings)
        .set({ ...sendingData, updatedAt: new Date() })
        .where(eq(messageSendings.id, id))
        .returning();
      return updatedSending;
    } catch (error) {
      console.error("Erro ao atualizar envio de mensagem:", error);
      return undefined;
    }
  }
  
  async deleteMessageSending(id: number): Promise<boolean> {
    try {
      const result = await db
        .delete(messageSendings)
        .where(eq(messageSendings.id, id));
      return result.length > 0;
    } catch (error) {
      console.error("Erro ao deletar envio de mensagem:", error);
      return false;
    }
  }
  
  // Message Sending History methods
  async getMessageSendingHistory(sendingId: number): Promise<MessageSendingHistory[]> {
    try {
      return db
        .select()
        .from(messageSendingHistory)
        .where(eq(messageSendingHistory.sendingId, sendingId))
        .orderBy(desc(messageSendingHistory.sentAt));
    } catch (error) {
      console.error("Erro ao buscar histórico de envio de mensagens:", error);
      return [];
    }
  }
  
  async createMessageSendingHistory(history: InsertMessageSendingHistory): Promise<MessageSendingHistory> {
    try {
      const [newHistory] = await db
        .insert(messageSendingHistory)
        .values(history)
        .returning();
      return newHistory;
    } catch (error) {
      console.error("Erro ao criar histórico de envio de mensagem:", error);
      throw error;
    }
  }

  // WhatsApp Contacts methods
  async getWhatsappContact(id: number): Promise<WhatsappContact | undefined> {
    try {
      const [contact] = await db
        .select()
        .from(whatsappContacts)
        .where(eq(whatsappContacts.id, id));
      return contact;
    } catch (error) {
      console.error("Erro ao buscar contato WhatsApp:", error);
      return undefined;
    }
  }

  async getWhatsappContactByContactId(userId: number, contactId: string): Promise<WhatsappContact | undefined> {
    try {
      const [contact] = await db
        .select()
        .from(whatsappContacts)
        .where(and(
          eq(whatsappContacts.userId, userId),
          eq(whatsappContacts.contactId, contactId)
        ));
      return contact;
    } catch (error) {
      console.error("Erro ao buscar contato WhatsApp por contactId:", error);
      return undefined;
    }
  }

  async getWhatsappContacts(userId: number): Promise<WhatsappContact[]> {
    try {
      return await db
        .select()
        .from(whatsappContacts)
        .where(eq(whatsappContacts.userId, userId));
    } catch (error) {
      console.error("Erro ao buscar contatos WhatsApp:", error);
      return [];
    }
  }

  async createWhatsappContact(contact: InsertWhatsappContact & { userId: number }): Promise<WhatsappContact> {
    try {
      const [newContact] = await db
        .insert(whatsappContacts)
        .values(contact)
        .returning();
      return newContact;
    } catch (error) {
      console.error("Erro ao criar contato WhatsApp:", error);
      throw error;
    }
  }

  async updateWhatsappContact(id: number, contactData: Partial<InsertWhatsappContact>): Promise<WhatsappContact | undefined> {
    try {
      const [updatedContact] = await db
        .update(whatsappContacts)
        .set(contactData)
        .where(eq(whatsappContacts.id, id))
        .returning();
      return updatedContact;
    } catch (error) {
      console.error("Erro ao atualizar contato WhatsApp:", error);
      return undefined;
    }
  }

  // WhatsApp Messages methods
  async getWhatsappMessage(id: number): Promise<WhatsappMessage | undefined> {
    try {
      const [message] = await db
        .select()
        .from(whatsappMessages)
        .where(eq(whatsappMessages.id, id));
      return message;
    } catch (error) {
      console.error("Erro ao buscar mensagem WhatsApp:", error);
      return undefined;
    }
  }

  async getWhatsappMessageByMessageId(userId: number, messageId: string): Promise<WhatsappMessage | undefined> {
    try {
      const [message] = await db
        .select()
        .from(whatsappMessages)
        .where(and(
          eq(whatsappMessages.userId, userId),
          eq(whatsappMessages.messageId, messageId)
        ));
      return message;
    } catch (error) {
      console.error("Erro ao buscar mensagem WhatsApp por messageId:", error);
      return undefined;
    }
  }

  async getWhatsappMessages(userId: number, contactId: number, limit?: number): Promise<WhatsappMessage[]> {
    try {
      let query = db
        .select()
        .from(whatsappMessages)
        .where(and(
          eq(whatsappMessages.userId, userId),
          eq(whatsappMessages.contactId, contactId)
        ))
        .orderBy(desc(whatsappMessages.timestamp));
      
      if (limit) {
        query = query.limit(limit);
      }
      
      return await query;
    } catch (error) {
      console.error("Erro ao buscar mensagens WhatsApp:", error);
      return [];
    }
  }

  async createWhatsappMessage(message: InsertWhatsappMessage & { userId: number; contactId: number }): Promise<WhatsappMessage> {
    try {
      const [newMessage] = await db
        .insert(whatsappMessages)
        .values(message)
        .returning();
      
      // Atualizar o contato com a última mensagem
      if (message.content) {
        const contact = await this.getWhatsappContact(message.contactId);
        if (contact) {
          const now = new Date();
          await this.updateWhatsappContact(contact.id, {
            lastMessageContent: message.content,
            lastActivity: now,
            unreadCount: message.fromMe ? contact.unreadCount : (contact.unreadCount || 0) + 1
          });
        }
      }
      
      return newMessage;
    } catch (error) {
      console.error("Erro ao criar mensagem WhatsApp:", error);
      throw error;
    }
  }

  async updateWhatsappMessage(id: number, messageData: Partial<InsertWhatsappMessage>): Promise<WhatsappMessage | undefined> {
    try {
      const [updatedMessage] = await db
        .update(whatsappMessages)
        .set(messageData)
        .where(eq(whatsappMessages.id, id))
        .returning();
      return updatedMessage;
    } catch (error) {
      console.error("Erro ao atualizar mensagem WhatsApp:", error);
      return undefined;
    }
  }
  
  // Servidor Methods
  async getServerById(id: number): Promise<Server | undefined> {
    try {
      const [server] = await db.select().from(servers).where(eq(servers.id, id));
      return server;
    } catch (error) {
      console.error("Erro ao buscar servidor:", error);
      return undefined;
    }
  }

  async getServersByProvider(provider: string): Promise<Server[]> {
    try {
      const serverList = await db.select().from(servers).where(eq(servers.provider, provider));
      return serverList;
    } catch (error) {
      console.error(`Erro ao buscar servidores do provedor ${provider}:`, error);
      return [];
    }
  }

  async getAllServers(): Promise<Server[]> {
    try {
      const serverList = await db.select().from(servers).orderBy(servers.name);
      return serverList;
    } catch (error) {
      console.error("Erro ao buscar todos os servidores:", error);
      return [];
    }
  }

  async getActiveServers(): Promise<Server[]> {
    try {
      const serverList = await db.select().from(servers)
        .where(eq(servers.active, true))
        .orderBy(servers.name);
      return serverList;
    } catch (error) {
      console.error("Erro ao buscar servidores ativos:", error);
      return [];
    }
  }

  async createServer(serverData: InsertServer): Promise<Server> {
    try {
      const [server] = await db.insert(servers).values(serverData).returning();
      return server;
    } catch (error) {
      console.error("Erro ao criar servidor:", error);
      throw error;
    }
  }

  async updateServer(id: number, serverData: Partial<InsertServer>): Promise<Server | undefined> {
    try {
      console.log(`[DatabaseStorage] Iniciando atualização do servidor ID: ${id}`);
      console.log(`[DatabaseStorage] Dados recebidos:`, JSON.stringify(serverData, null, 2));
      
      // Verificar primeiro se o servidor existe
      const existingServer = await db.select().from(servers).where(eq(servers.id, id)).limit(1);
      
      if (!existingServer || existingServer.length === 0) {
        console.log(`[DatabaseStorage] Servidor ID ${id} não encontrado`);
        return undefined;
      }
      
      console.log(`[DatabaseStorage] Servidor encontrado, realizando update`);
      
      // Garantir que dados numéricos sejam convertidos corretamente
      const processedData = {
        ...serverData,
        maxUsers: serverData.maxUsers ? Number(serverData.maxUsers) : undefined,
        updatedAt: new Date()
      };
      
      console.log(`[DatabaseStorage] Dados processados:`, JSON.stringify(processedData, null, 2));
      
      const [server] = await db.update(servers)
        .set(processedData)
        .where(eq(servers.id, id))
        .returning();
      
      console.log(`[DatabaseStorage] Servidor atualizado com sucesso:`, JSON.stringify(server, null, 2));
      return server;
    } catch (error) {
      console.error("[DatabaseStorage] Erro ao atualizar servidor:", error);
      // Lançar o erro para poder ser tratado na rota
      throw error;
    }
  }

  async deleteServer(id: number): Promise<boolean> {
    try {
      // Primeiro remover as associações com usuários
      await db.delete(userServers).where(eq(userServers.serverId, id));
      
      // Depois remover o servidor
      const result = await db.delete(servers).where(eq(servers.id, id));
      return result.count > 0;
    } catch (error) {
      console.error("Erro ao deletar servidor:", error);
      return false;
    }
  }

  // UserServer Methods
  async getUserServers(userId: number): Promise<(UserServer & { server: Server | null })[]> {
    try {
      console.log(`Buscando servidores do usuário ${userId} (implementação corrigida)`);
      
      // Primeiro buscar as relações usuário-servidor
      const relations = await db
        .select()
        .from(userServers)
        .where(eq(userServers.userId, userId));
      
      console.log(`Encontradas ${relations.length} relações usuário-servidor para o usuário ${userId}`);
      
      if (!relations || relations.length === 0) {
        return [];
      }
      
      // Para cada relação, buscar os detalhes do servidor individualmente
      const result: (UserServer & { server: Server | null })[] = [];
      
      for (const relation of relations) {
        try {
          // Buscar servidor específico
          const [serverData] = await db
            .select()
            .from(servers)
            .where(eq(servers.id, relation.serverId));
          
          console.log(`📋 Servidor encontrado para usuário ${userId}:`);
          console.log(`   - ID do Servidor: ${serverData?.id}`);
          console.log(`   - Nome: ${serverData?.name}`);
          console.log(`   - API Token: ${serverData?.apiToken?.substring(0, 5)}...${serverData?.apiToken?.substring(serverData?.apiToken.length - 4)}`);
          
          result.push({
            ...relation,
            server: serverData || null
          });
        } catch (serverError) {
          console.error(`Erro ao buscar servidor ${relation.serverId}:`, serverError);
          result.push({
            ...relation,
            server: null
          });
        }
      }
      
      console.log(`Retornando ${result.length} servidores para o usuário ${userId}`);
      return result;
    } catch (error) {
      console.error(`Erro ao buscar servidores do usuário ${userId}:`, error);
      return [];
    }
  }

  async addUserServer(userId: number, serverId: number): Promise<UserServer | undefined> {
    try {
      const [userServer] = await db.insert(userServers)
        .values({ userId, serverId })
        .returning();
      return userServer;
    } catch (error) {
      console.error("Erro ao adicionar servidor ao usuário:", error);
      return undefined;
    }
  }

  async removeUserServer(userId: number, serverId: number): Promise<boolean> {
    try {
      const result = await db.delete(userServers)
        .where(and(
          eq(userServers.userId, userId),
          eq(userServers.serverId, serverId)
        ));
      return result.count > 0;
    } catch (error) {
      console.error("Erro ao remover servidor do usuário:", error);
      return false;
    }
  }
  
  async getUserServerRelationById(relationId: number): Promise<UserServer | undefined> {
    try {
      const [relation] = await db.select()
        .from(userServers)
        .where(eq(userServers.id, relationId));
      
      console.log(`Buscando relação com ID ${relationId}:`, relation);
      return relation;
    } catch (error) {
      console.error(`Erro ao buscar relação usuário-servidor com ID ${relationId}:`, error);
      return undefined;
    }
  }
  
  async getUserServerRelationsByUserId(userId: number): Promise<UserServer[]> {
    try {
      console.log(`Buscando relações de servidor para o usuário ${userId}`);
      const relations = await db.select()
        .from(userServers)
        .where(eq(userServers.userId, userId));
      
      console.log(`Encontradas ${relations.length} relações para o usuário ${userId}`);
      return relations;
    } catch (error) {
      console.error(`Erro ao buscar relações de servidor para o usuário ${userId}:`, error);
      return [];
    }
  }
  
  async removeUserServerRelation(relationId: number): Promise<boolean> {
    try {
      console.log(`Removendo relação com ID ${relationId}`);
      const result = await db.delete(userServers)
        .where(eq(userServers.id, relationId));
      
      return result.count > 0;
    } catch (error) {
      console.error(`Erro ao remover relação usuário-servidor com ID ${relationId}:`, error);
      return false;
    }
  }
  
  async getServerUsers(serverId: number): Promise<any[]> {
    try {
      // Buscar as relações usuário-servidor para o servidor específico
      const relations = await db
        .select()
        .from(userServers)
        .where(eq(userServers.serverId, serverId));
      
      console.log(`Relações encontradas para o servidor ${serverId}:`, relations.length);
      
      if (!relations || relations.length === 0) {
        return [];
      }
      
      // Obter IDs dos usuários
      const userIds = relations.map(r => r.userId);
      
      // Buscar informações completas de cada usuário em uma única consulta
      const usersList = await db
        .select()
        .from(users)
        .where(inArray(users.id, userIds));
      
      console.log(`Usuários encontrados: ${usersList.length}`);
      
      // Combinar relações com usuários
      const userDetails = relations.map(relation => {
        const userInfo = usersList.find(u => u.id === relation.userId);
        
        return {
          id: relation.id,
          userId: relation.userId,
          serverId: relation.serverId,
          createdAt: relation.createdAt,
          user: userInfo ? {
            id: userInfo.id,
            name: userInfo.name,
            username: userInfo.username,
            email: userInfo.email
            // Não incluir senha e outras informações sensíveis
          } : null
        };
      });
      
      return userDetails;
    } catch (error) {
      console.error(`Erro ao buscar usuários do servidor ${serverId}:`, error);
      return [];
    }
  }
  
  async updateUserServerId(userId: number, serverId: number): Promise<User | undefined> {
    try {
      // Verificar se o usuário e o servidor existem
      const userExists = await this.getUser(userId);
      const serverExists = await this.getServerById(serverId);
      
      if (!userExists || !serverExists) {
        console.error("Usuário ou servidor não encontrado");
        return undefined;
      }
      
      // Atualizar o serverId do usuário
      const [updatedUser] = await db.update(users)
        .set({ serverId })
        .where(eq(users.id, userId))
        .returning();
        
      return updatedUser;
    } catch (error) {
      console.error("Erro ao atualizar o servidor do usuário:", error);
      return undefined;
    }
  }
  
  // Contar usuários por servidor para mostrar ocupação
  async countUsersByServer(): Promise<{ serverId: number; userCount: number }[]> {
    try {
      const results = await db
        .select({
          serverId: userServers.serverId,
          userCount: count(userServers.userId),
        })
        .from(userServers)
        .groupBy(userServers.serverId);
      
      return results;
    } catch (error) {
      console.error("Erro ao contar usuários por servidor:", error);
      return [];
    }
  }

  // Encontra o servidor com MAIOR ocupação que ainda tenha capacidade disponível
  // O nome da função é um pouco enganoso - na verdade ele retorna o servidor mais "cheio"
  // que ainda pode aceitar mais usuários, para maximizar a ocupação e evitar servidores subutilizados
  async getServerWithLeastUsers(onlyActive: boolean = true): Promise<Server | undefined> {
    try {
      // Obter contagem de usuários por servidor
      const userCountMap = await this.countUsersByServer();
      
      // Criar uma consulta para buscar servidores
      let query = db.select().from(servers);
      
      // Adicionar filtro de servidores ativos se solicitado
      if (onlyActive) {
        query = query.where(eq(servers.active, true));
      }
      
      // Buscar todos os servidores (ativos, se especificado)
      const serversList = await query;
      
      if (serversList.length === 0) return undefined;
      
      // Encontrar o servidor que está mais próximo de atingir sua capacidade máxima (menor disponibilidade proporcional)
      let bestServer: Server | undefined = undefined;
      let highestUtilizationRatio = -1; // Começamos com -1 para garantir que qualquer razão positiva seja maior
      
      for (const server of serversList) {
        const userCount = userCountMap.find(uc => uc.serverId === server.id)?.userCount || 0;
        const maxUsers = server.maxUsers || 10; // Default de 10 se não especificado
        
        // Calcular a razão de utilização (quanto maior, mais próximo de estar cheio)
        const utilizationRatio = userCount / maxUsers;
        
        // Verificar se o servidor ainda tem capacidade disponível e se tem uma taxa de utilização maior
        if (userCount < maxUsers && utilizationRatio > highestUtilizationRatio) {
          highestUtilizationRatio = utilizationRatio;
          bestServer = server;
        }
      }
      
      console.log(`Selecionado servidor com maior taxa de utilização: ${bestServer?.name} (${highestUtilizationRatio.toFixed(2)})`);
      return bestServer;
    } catch (error) {
      console.error("Erro ao buscar servidor com menos usuários:", error);
      return undefined;
    }
  }
}

export const storage = new DatabaseStorage();