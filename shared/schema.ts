import { pgTable, text, serial, integer, boolean, timestamp, json, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name"),
  company: text("company"),
  phone: text("phone"),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  prospectingWebhookUrl: text("prospecting_webhook_url"),
});

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color").default("#047857"),
  secondaryColor: text("secondary_color").default("#4f46e5"),
  darkMode: boolean("dark_mode").default(false),
});

export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  company: text("company"),
  status: text("status").default("novo"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const prospects = pgTable("prospects", {
  id: serial("id").primaryKey(), 
  userId: integer("user_id").references(() => users.id),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  company: text("company"),
  status: text("status").default("novo"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const dispatches = pgTable("dispatches", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  title: text("title").notNull(),
  message: text("message").notNull(),
  status: text("status").default("pendente"),
  scheduledFor: timestamp("scheduled_for"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const metrics = pgTable("metrics", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  month: text("month").notNull(),
  year: integer("year").notNull(),
  leadsCount: integer("leads_count").default(0),
  prospectsCount: integer("prospects_count").default(0),
  dispatchesCount: integer("dispatches_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Tabela para o Agente de IA
export const aiAgent = pgTable("ai_agent", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  enabled: boolean("enabled").default(false),
  triggerText: text("trigger_text"),
  personality: text("personality"),
  expertise: text("expertise"),
  voiceTone: text("voice_tone"),
  rules: text("rules"),
  followUpEnabled: boolean("follow_up_enabled").default(false),
  followUpCount: integer("follow_up_count").default(0),
  messageInterval: text("message_interval").default("30 minutos"),
  followUpPrompt: text("follow_up_prompt"),
  schedulingEnabled: boolean("scheduling_enabled").default(false),
  agendaId: text("agenda_id"),
  schedulingPromptConsult: text("scheduling_prompt_consult"),
  schedulingPromptTime: text("scheduling_prompt_time"),
  schedulingDuration: text("scheduling_duration"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const aiAgentSteps = pgTable("ai_agent_steps", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  order: integer("order").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const aiAgentFaqs = pgTable("ai_agent_faqs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Enum para tipos de interações com leads
export const interactionTypeEnum = pgEnum("interaction_type", [
  "click", 
  "email_open", 
  "email_reply", 
  "whatsapp_reply", 
  "meeting_scheduled", 
  "meeting_attended", 
  "document_download", 
  "form_submission"
]);

// Tabela para registrar interações com leads
export const leadInteractions = pgTable("lead_interactions", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").references(() => leads.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  type: interactionTypeEnum("type").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  metadata: json("metadata"),
});

// Tabela para recomendações de leads
export const leadRecommendations = pgTable("lead_recommendations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  leadId: integer("lead_id").references(() => leads.id).notNull(),
  score: integer("score").notNull(), // Pontuação de recomendação (0-100)
  reason: text("reason").notNull(), // Razão para a recomendação
  status: text("status").default("pendente"), // pendente, vista, ignorada, convertida
  createdAt: timestamp("created_at").defaultNow(),
  actedAt: timestamp("acted_at"), // Quando o usuário agiu na recomendação
});

// Insert Schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  password: true,
  name: true,
  company: true,
  phone: true,
  bio: true,
  prospectingWebhookUrl: true,
});

// Lead Interactions Insert Schema
export const insertLeadInteractionSchema = createInsertSchema(leadInteractions)
  .pick({
    type: true,
    metadata: true,
  })
  .extend({
    leadId: z.number().optional(), // Torna opcional pois pode ser fornecido pela URL
  });

// Lead Recommendations Insert Schema
export const insertLeadRecommendationSchema = createInsertSchema(leadRecommendations).pick({
  leadId: true,
  score: true,
  reason: true,
  status: true,
});

export const insertLeadSchema = createInsertSchema(leads).pick({
  name: true,
  email: true,
  phone: true,
  company: true,
  status: true,
});

export const insertProspectSchema = createInsertSchema(prospects).pick({
  name: true,
  email: true,
  phone: true,
  company: true,
  status: true,
});

export const insertDispatchSchema = createInsertSchema(dispatches).pick({
  title: true,
  message: true,
  status: true,
  scheduledFor: true,
});

export const insertSettingsSchema = createInsertSchema(settings).pick({
  logoUrl: true,
  primaryColor: true,
  secondaryColor: true,
  darkMode: true,
});

// AI Agent Insert Schemas
export const insertAiAgentSchema = createInsertSchema(aiAgent).pick({
  enabled: true,
  triggerText: true,
  personality: true,
  expertise: true,
  voiceTone: true,
  rules: true,
  followUpEnabled: true,
  followUpCount: true,
  messageInterval: true,
  followUpPrompt: true,
  schedulingEnabled: true,
  agendaId: true,
  schedulingPromptConsult: true,
  schedulingPromptTime: true,
  schedulingDuration: true,
});

export const insertAiAgentStepsSchema = createInsertSchema(aiAgentSteps).pick({
  name: true,
  description: true,
  order: true,
});

export const insertAiAgentFaqsSchema = createInsertSchema(aiAgentFaqs).pick({
  question: true,
  answer: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;

export type InsertProspect = z.infer<typeof insertProspectSchema>;
export type Prospect = typeof prospects.$inferSelect;

export type InsertDispatch = z.infer<typeof insertDispatchSchema>;
export type Dispatch = typeof dispatches.$inferSelect;

export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settings.$inferSelect;

export type Metric = typeof metrics.$inferSelect;

// AI Agent Types
export type AiAgent = typeof aiAgent.$inferSelect;
export type AiAgentSteps = typeof aiAgentSteps.$inferSelect;
export type AiAgentFaqs = typeof aiAgentFaqs.$inferSelect;

export type InsertAiAgent = z.infer<typeof insertAiAgentSchema>;
export type InsertAiAgentSteps = z.infer<typeof insertAiAgentStepsSchema>;
export type InsertAiAgentFaqs = z.infer<typeof insertAiAgentFaqsSchema>;

// Tabela para prospecções
export const prospectingSearches = pgTable("prospecting_searches", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  segment: text("segment").notNull(),
  city: text("city"),
  filters: text("filters"),
  status: text("status").default("pendente"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  leadsFound: integer("leads_found").default(0),
  dispatchesDone: integer("dispatches_done").default(0),
  dispatchesPending: integer("dispatches_pending").default(0),
  webhookUrl: text("webhook_url"),
});

// Tabela para resultados de prospecção
export const prospectingResults = pgTable("prospecting_results", {
  id: serial("id").primaryKey(),
  searchId: integer("search_id").references(() => prospectingSearches.id).notNull(),
  name: text("name"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  type: text("type"),
  createdAt: timestamp("created_at").defaultNow(),
  dispatchedAt: timestamp("dispatched_at"),
});

// Schema para inserção de prospecções
export const insertProspectingSearchSchema = createInsertSchema(prospectingSearches).pick({
  segment: true,
  city: true,
  filters: true,
  webhookUrl: true,
  status: true,
  leadsFound: true,
  dispatchesDone: true,
  dispatchesPending: true
});

// Schema para inserção de resultados de prospecção
export const insertProspectingResultSchema = createInsertSchema(prospectingResults).pick({
  name: true,
  phone: true,
  email: true,
  address: true,
  type: true,
});

// Lead Recommendation Types
export type LeadInteraction = typeof leadInteractions.$inferSelect;
export type InsertLeadInteraction = z.infer<typeof insertLeadInteractionSchema>;

export type LeadRecommendation = typeof leadRecommendations.$inferSelect;
export type InsertLeadRecommendation = z.infer<typeof insertLeadRecommendationSchema>;

// Prospecting Types
export type ProspectingSearch = typeof prospectingSearches.$inferSelect;
export type InsertProspectingSearch = z.infer<typeof insertProspectingSearchSchema>;

export type ProspectingResult = typeof prospectingResults.$inferSelect;
export type InsertProspectingResult = z.infer<typeof insertProspectingResultSchema>;

// Connection Types
export interface ConnectionStatus {
  connected: boolean;
  name?: string;
  phone?: string;
  qrCode?: string;
  lastUpdated?: Date;
}
