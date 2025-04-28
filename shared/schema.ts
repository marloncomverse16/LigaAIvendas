import { pgTable, text, serial, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
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

// Insert Schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  password: true,
  name: true,
  company: true,
  phone: true,
  bio: true,
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
