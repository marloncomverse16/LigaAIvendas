import { pgTable, text, serial, integer, boolean, timestamp, json, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { type InferSelectModel, type InferInsertModel } from "drizzle-orm";

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
  // Webhooks para integração
  whatsappWebhookUrl: text("whatsapp_webhook_url"),
  aiAgentWebhookUrl: text("ai_agent_webhook_url"),
  prospectingWebhookUrl: text("prospecting_webhook_url"),
  dispatchesWebhookUrl: text("dispatches_webhook_url"),
  contactsWebhookUrl: text("contacts_webhook_url"),
  schedulingWebhookUrl: text("scheduling_webhook_url"),
  crmWebhookUrl: text("crm_webhook_url"),
  // Tokens e configurações avançadas
  availableTokens: integer("available_tokens").default(0),
  tokenExpirationDays: integer("token_expiration_days").default(30),
  monthlyFee: text("monthly_fee").default("0"),
  serverAddress: text("server_address"),
  serverId: integer("server_id"),
  // Instância do WhatsApp
  whatsappInstanceWebhook: text("whatsapp_instance_webhook"),
  whatsappInstanceId: text("whatsapp_instance_id"),
  // Evolution API
  whatsappApiUrl: text("whatsapp_api_url"),
  whatsappApiToken: text("whatsapp_api_token"),
  // Meta WhatsApp Cloud API
  metaPhoneNumberId: text("meta_phone_number_id"), // ID do número de telefone no WhatsApp Business
  metaConnected: boolean("meta_connected").default(false), // Indica se está conectado diretamente à API da Meta
  metaConnectedAt: timestamp("meta_connected_at"),
  isAdmin: boolean("is_admin").default(false),
  // Controle de acesso a módulos 
  accessDashboard: boolean("access_dashboard").default(true),
  accessLeads: boolean("access_leads").default(true),
  accessProspecting: boolean("access_prospecting").default(true),
  accessAiAgent: boolean("access_ai_agent").default(true),
  accessWhatsapp: boolean("access_whatsapp").default(true),
  accessContacts: boolean("access_contacts").default(true),
  accessScheduling: boolean("access_scheduling").default(true),
  accessReports: boolean("access_reports").default(true),
  accessSettings: boolean("access_settings").default(true),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color").default("#047857"),
  secondaryColor: text("secondary_color").default("#4f46e5"),
  darkMode: boolean("dark_mode").default(false),
  // Metas
  metaVendasEmpresa: text("meta_vendas_empresa").default("0"),
  ticketMedioVendas: text("ticket_medio_vendas").default("0"),
  quantidadeLeadsVendas: integer("quantidade_leads_vendas").default(0),
  quantosDisparosPorLead: integer("quantos_disparos_por_lead").default(1),
  custoIcloudTotal: text("custo_icloud_total").default("0"),
  quantasMensagensEnviadas: integer("quantas_mensagens_enviadas").default(0),
  // WhatsApp Meta Cloud API (Específico por usuário)
  whatsappMetaToken: text("whatsapp_meta_token").notNull().default(""), // Token de acesso à API da Meta
  whatsappMetaBusinessId: text("whatsapp_meta_business_id").notNull().default(""), // ID do negócio na Meta
  whatsappMetaApiVersion: text("whatsapp_meta_api_version").default("v18.0"),
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
  mediaDownloadUrl: text("media_download_url"), // Link de download do arquivo
  mediaFilename: text("media_filename"), // Nome original do arquivo
  mediaFormat: text("media_format"), // Formato do arquivo (pdf, csv, excel)
  autoMoveCrm: boolean("auto_move_crm").default(false),
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
  mediaData: text("media_data"), // Dados binários do arquivo codificados em base64
  mediaFilename: text("media_filename"), // Nome original do arquivo
  mediaType: text("media_type"), // MIME type do arquivo
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const aiAgentFaqs = pgTable("ai_agent_faqs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  mediaData: text("media_data"), // Dados binários do arquivo codificados em base64
  mediaFilename: text("media_filename"), // Nome original do arquivo
  mediaType: text("media_type"), // MIME type do arquivo
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
export const insertUserSchema = createInsertSchema(users);

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
  // Campos de metas
  metaVendasEmpresa: true,
  ticketMedioVendas: true,
  quantidadeLeadsVendas: true,
  quantosDisparosPorLead: true,
  custoIcloudTotal: true,
  quantasMensagensEnviadas: true,
  // WhatsApp Meta API
  whatsappMetaToken: true,
  whatsappMetaBusinessId: true,
  whatsappMetaApiVersion: true,
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
  cidade: text("cidade"),
  estado: text("estado"),
  site: text("site"),
  type: text("type"),
  createdAt: timestamp("created_at").defaultNow(),
  dispatchedAt: timestamp("dispatched_at"),
});

// Tabela para agendamentos de envios
export const prospectingSchedules = pgTable("prospecting_schedules", {
  id: serial("id").primaryKey(),
  searchId: integer("search_id").references(() => prospectingSearches.id).notNull(),
  scheduledAt: timestamp("scheduled_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  status: text("status").default("pendente"),
  executedAt: timestamp("executed_at"),
  createdBy: integer("created_by").references(() => users.id),
});

// Tabela para histórico de envios
export const prospectingDispatchHistory = pgTable("prospecting_dispatch_history", {
  id: serial("id").primaryKey(),
  searchId: integer("search_id").references(() => prospectingSearches.id).notNull(),
  executedAt: timestamp("executed_at").defaultNow(),
  success: boolean("success").default(true),
  resultsCount: integer("results_count").default(0),
  errorMessage: text("error_message"),
  executedBy: integer("executed_by").references(() => users.id),
  scheduledId: integer("scheduled_id").references(() => prospectingSchedules.id),
});

// Tabelas para WhatsApp Cloud API (Meta API)
export const whatsappCloudChats = pgTable("whatsapp_cloud_chats", {
  id: text("id").primaryKey(), // ID único do chat na Meta API
  userId: integer("user_id").references(() => users.id).notNull(),
  remoteJid: text("remote_jid").notNull(), // ID do contato (ex: 5511999998888@c.us)
  pushName: text("push_name"), // Nome do contato
  profilePicUrl: text("profile_pic_url"), // URL da foto de perfil
  lastMessageTime: timestamp("last_message_time"),
  unreadCount: integer("unread_count").default(0),
  phoneNumber: text("phone_number"), // Número de telefone limpo
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const whatsappCloudMessages = pgTable("whatsapp_cloud_messages", {
  id: text("id").primaryKey(), // ID único da mensagem na Meta API
  chatId: text("chat_id").references(() => whatsappCloudChats.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  remoteJid: text("remote_jid").notNull(), // Para quem a mensagem foi enviada/recebida
  messageContent: text("message_content"), // Conteúdo da mensagem
  messageType: text("message_type").default("text"), // text, image, audio, video, document
  fromMe: boolean("from_me").default(false), // Se a mensagem foi enviada por mim
  timestamp: timestamp("timestamp").notNull(),
  status: text("status").default("sent"), // sent, delivered, read, failed
  quotedMessageId: text("quoted_message_id"), // ID da mensagem citada (para respostas)
  mediaUrl: text("media_url"), // URL do arquivo de mídia
  mediaCaption: text("media_caption"), // Legenda da mídia
  metaMessageId: text("meta_message_id"), // ID da mensagem na Meta API
  createdAt: timestamp("created_at").defaultNow(),
});

// Schemas para inserção
export const insertWhatsappCloudChatSchema = createInsertSchema(whatsappCloudChats);
export const insertWhatsappCloudMessageSchema = createInsertSchema(whatsappCloudMessages);

export type WhatsappCloudChat = typeof whatsappCloudChats.$inferSelect;
export type WhatsappCloudMessage = typeof whatsappCloudMessages.$inferSelect;
export type InsertWhatsappCloudChat = z.infer<typeof insertWhatsappCloudChatSchema>;
export type InsertWhatsappCloudMessage = z.infer<typeof insertWhatsappCloudMessageSchema>;

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
  searchId: true,
  name: true,
  phone: true,
  email: true,
  address: true,
  cidade: true,
  estado: true,
  site: true,
  type: true,
});

// Schema para inserção de agendamentos
export const insertProspectingScheduleSchema = createInsertSchema(prospectingSchedules).pick({
  searchId: true,
  scheduledAt: true,
  status: true,
  createdBy: true,
});

// Schema para inserção de histórico de envios
export const insertProspectingDispatchHistorySchema = createInsertSchema(prospectingDispatchHistory).pick({
  searchId: true,
  success: true,
  resultsCount: true,
  errorMessage: true,
  executedBy: true,
  scheduledId: true,
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
// Tabela para mensagens padrão
export const messageTemplates = pgTable("message_templates", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  tags: text("tags"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tabela para envios de mensagens agendados
export const messageSendings = pgTable("message_sendings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  searchId: integer("search_id").references(() => prospectingSearches.id),
  templateId: integer("template_id").references(() => messageTemplates.id),
  customMessage: text("custom_message"),
  quantity: integer("quantity").default(10),
  scheduledAt: timestamp("scheduled_at"),
  executedAt: timestamp("executed_at"),
  status: text("status").default("agendado"), // agendado, enviado, erro, cancelado
  aiLearningEnabled: boolean("ai_learning_enabled").default(false),
  aiNotes: text("ai_notes"),
  whatsappConnectionType: text("whatsapp_connection_type").default("qrcode"), // qrcode ou meta
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tabela para histórico de envios de mensagens
export const messageSendingHistory = pgTable("message_sending_history", {
  id: serial("id").primaryKey(),
  sendingId: integer("sending_id").references(() => messageSendings.id), // Removido .notNull()
  resultId: integer("result_id").references(() => prospectingResults.id),
  status: text("status").default("sucesso"), // sucesso, erro, pendente
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at").defaultNow(),
  
  // Campos adicionais para suporte ao envio direto pela Meta API
  userId: integer("user_id").references(() => users.id),
  searchId: integer("search_id").references(() => prospectingSearches.id),
  templateId: text("template_id"), // ID do template (para Meta API)
  templateName: text("template_name"), // Nome do template (para Meta API)
  messageText: text("message_text"), // Texto da mensagem (para mensagens diretas)
  connectionType: text("connection_type"), // whatsapp_qr ou whatsapp_meta_api
  totalRecipients: integer("total_recipients"),
  successCount: integer("success_count").default(0),
  errorCount: integer("error_count").default(0),
  webhookUrl: text("webhook_url"), // Para envios via webhook
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// Schema para inserção de mensagens padrão
export const insertMessageTemplateSchema = createInsertSchema(messageTemplates).pick({
  title: true,
  content: true,
  tags: true,
});

// Schema para inserção de envios de mensagens
export const insertMessageSendingSchema = createInsertSchema(messageSendings).pick({
  searchId: true,
  templateId: true,
  customMessage: true,
  quantity: true,
  scheduledAt: true,
  status: true,
  aiLearningEnabled: true,
  aiNotes: true,
  whatsappConnectionType: true,
});

// Schema para histórico de envios
export const insertMessageSendingHistorySchema = createInsertSchema(messageSendingHistory).pick({
  sendingId: true,
  resultId: true,
  status: true,
  errorMessage: true,
  
  // Campos adicionais para o novo fluxo de envio
  userId: true,
  searchId: true,
  templateId: true,
  templateName: true,
  messageText: true,
  connectionType: true,
  totalRecipients: true,
  webhookUrl: true,
});

// Types
export type MessageTemplate = typeof messageTemplates.$inferSelect;
export type InsertMessageTemplate = z.infer<typeof insertMessageTemplateSchema>;

export type MessageSending = typeof messageSendings.$inferSelect;
export type InsertMessageSending = z.infer<typeof insertMessageSendingSchema>;

export type MessageSendingHistory = typeof messageSendingHistory.$inferSelect;
export type InsertMessageSendingHistory = z.infer<typeof insertMessageSendingHistorySchema>;

export interface ConnectionStatus {
  connected: boolean;
  name?: string;
  phone?: string;
  qrCode?: string;
  lastUpdated?: Date;
}

// Contatos do WhatsApp
export const whatsappContacts = pgTable("whatsapp_contacts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  contactId: text("contact_id").notNull(), // ID na Evolution API
  name: text("name"),
  number: text("number").notNull(),
  profilePicture: text("profile_picture"),
  isGroup: boolean("is_group").default(false),
  lastActivity: timestamp("last_activity"),
  lastMessageContent: text("last_message_content"),
  unreadCount: integer("unread_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Mensagens do WhatsApp
export const whatsappMessages = pgTable("whatsapp_messages", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  contactId: integer("contact_id").references(() => whatsappContacts.id),
  messageId: text("message_id").notNull(), // ID na Evolution API
  chatId: text("chat_id").notNull(), // ID do chat/contato (remoteJid)
  remoteJid: text("remote_jid").notNull(), // JID do contato/grupo
  content: text("content"), // Conteúdo da mensagem
  pushName: text("push_name"), // Nome do remetente
  messageType: text("message_type"), // Tipo da mensagem (texto, imagem, etc)
  fromMe: boolean("from_me").default(false), // Se a mensagem foi enviada por mim
  timestamp: timestamp("timestamp").defaultNow(), // Timestamp da mensagem
  messageTimestamp: integer("message_timestamp").notNull().default(0), // Timestamp original da mensagem (em segundos)
  instanceId: text("instance_id"), // ID da instância do WhatsApp
  mediaType: text("media_type"), // image, video, audio, document
  mediaUrl: text("media_url"), // URL da mídia
  isRead: boolean("is_read").default(false), // Se a mensagem foi lida
  createdAt: timestamp("created_at").defaultNow(), // Data de criação no banco
  expiresAt: timestamp("expires_at"), // Data de expiração (90 dias)
});

// Schema para inserção de contatos
export const insertWhatsappContactSchema = createInsertSchema(whatsappContacts).pick({
  contactId: true,
  name: true,
  number: true,
  profilePicture: true,
  isGroup: true,
  lastActivity: true,
  lastMessageContent: true,
  unreadCount: true,
});

// Schema para inserção de mensagens
export const insertWhatsappMessageSchema = createInsertSchema(whatsappMessages).pick({
  contactId: true,
  messageId: true,
  chatId: true,
  remoteJid: true,
  content: true,
  pushName: true, 
  messageType: true,
  fromMe: true,
  timestamp: true,
  messageTimestamp: true,
  instanceId: true,
  mediaType: true,
  mediaUrl: true,
  isRead: true,
});

export type WhatsappContact = typeof whatsappContacts.$inferSelect;
export type InsertWhatsappContact = z.infer<typeof insertWhatsappContactSchema>;

export type WhatsappMessage = typeof whatsappMessages.$inferSelect;
export type InsertWhatsappMessage = z.infer<typeof insertWhatsappMessageSchema>;



// Tabela para servidores
export const servers = pgTable("servers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  ipAddress: text("ip_address").notNull(),
  provider: text("provider").notNull(), // Nome personalizado do provedor
  apiUrl: text("api_url").notNull(),
  apiToken: text("api_token"),
  n8nApiUrl: text("n8n_api_url"), // URL da API do n8n
  
  // Campos para WhatsApp Cloud API direta (Meta)
  whatsappMetaToken: text("whatsapp_meta_token"), // Token de acesso para API da Meta
  whatsappMetaBusinessId: text("whatsapp_meta_business_id"), // ID do negócio na Meta
  whatsappMetaApiVersion: text("whatsapp_meta_api_version").default("v18.0"), // Versão da API da Meta
  
  // URLs de Webhook específicos para cada funcionalidade
  whatsappWebhookUrl: text("whatsapp_webhook_url"),
  // Mantido para compatibilidade - migrando para a nova tabela server_ai_agents
  aiAgentName: text("ai_agent_name"), // Nome do agente de IA
  aiAgentWebhookUrl: text("ai_agent_webhook_url"),
  
  prospectingWebhookUrl: text("prospecting_webhook_url"),
  contactsWebhookUrl: text("contacts_webhook_url"),
  schedulingWebhookUrl: text("scheduling_webhook_url"),
  crmWebhookUrl: text("crm_webhook_url"),
  messageSendingWebhookUrl: text("message_sending_webhook_url"), // Webhook para envio de mensagens
  
  instanceId: text("instance_id"), // Para servidores Evolution API (configurado separadamente)
  maxUsers: integer("max_users").default(10), // Limite de usuários que podem ser associados ao servidor
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tabela para múltiplos agentes de IA associados a um servidor
export const serverAiAgents = pgTable("server_ai_agents", {
  id: serial("id").primaryKey(),
  serverId: integer("server_id").notNull().references(() => servers.id),
  name: text("name").notNull(), // Nome do agente de IA
  description: text("description"),
  webhookUrl: text("webhook_url"), // URL do webhook para integrações deste agente
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// Tabela para associar agentes IA dos servidores aos usuários
export const userAiAgents = pgTable("user_ai_agents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  agentId: integer("agent_id").notNull().references(() => serverAiAgents.id),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// Tabela de contatos unificada (QR Code + Cloud API)
export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  phoneNumber: text("phone_number").notNull(),
  name: text("name"),
  profilePicture: text("profile_picture"),
  lastMessageTime: timestamp("last_message_time"),
  lastMessage: text("last_message"),
  source: text("source").notNull(), // 'qr_code' ou 'cloud_api'
  serverId: integer("server_id").references(() => servers.id),
  isActive: boolean("is_active").default(true),
  notes: text("notes"),
  tags: text("tags").array().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Tabelas para relatórios Meta
export const metaConversationReports = pgTable("meta_conversation_reports", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  phoneNumberId: text("phone_number_id").notNull(),
  conversationId: text("conversation_id").notNull(),
  contactNumber: text("contact_number").notNull(),
  conversationType: text("conversation_type").notNull(), // user_initiated, business_initiated
  isFreeWindow: boolean("is_free_window").default(false),
  startedAt: timestamp("started_at").notNull(),
  endedAt: timestamp("ended_at"),
  messageCount: integer("message_count").default(0),
  totalCost: text("total_cost").default("0"), // Custo em USD
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const metaMessageReports = pgTable("meta_message_reports", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  phoneNumberId: text("phone_number_id").notNull(),
  messageId: text("message_id").notNull(),
  contactNumber: text("contact_number").notNull(),
  messageType: text("message_type").notNull(), // text, template, media
  templateName: text("template_name"),
  messageDirection: text("message_direction").notNull(), // inbound, outbound
  deliveryStatus: text("delivery_status").notNull(), // sent, delivered, read, failed
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at").notNull(),
  deliveredAt: timestamp("delivered_at"),
  readAt: timestamp("read_at"),
  cost: text("cost").default("0"), // Custo individual em USD
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const metaBillingReports = pgTable("meta_billing_reports", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  phoneNumberId: text("phone_number_id").notNull(),
  reportDate: timestamp("report_date").notNull(),
  conversationCount: integer("conversation_count").default(0),
  freeConversationCount: integer("free_conversation_count").default(0),
  paidConversationCount: integer("paid_conversation_count").default(0),
  messageCount: integer("message_count").default(0),
  templateMessageCount: integer("template_message_count").default(0),
  totalCost: text("total_cost").default("0"), // Custo total em USD
  currency: text("currency").default("USD"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const metaLeadResponseReports = pgTable("meta_lead_response_reports", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  phoneNumberId: text("phone_number_id").notNull(),
  contactNumber: text("contact_number").notNull(),
  leadSource: text("lead_source"), // prospecting, manual, webhook
  firstMessageAt: timestamp("first_message_at").notNull(),
  firstResponseAt: timestamp("first_response_at"),
  responseTime: integer("response_time"), // Tempo de resposta em minutos
  totalMessages: integer("total_messages").default(0),
  hasResponse: boolean("has_response").default(false),
  leadStatus: text("lead_status").default("new"), // new, responded, converted, lost
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Relação entre usuários e servidores
export const userServers = pgTable("user_servers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  serverId: integer("server_id").notNull().references(() => servers.id),
  isDefault: boolean("is_default").default(false),
  
  // Campos para WhatsApp Meta API (Cloud API)
  metaPhoneNumberId: text("meta_phone_number_id"), // ID do número de telefone no WhatsApp Business
  metaConnected: boolean("meta_connected").default(false), // Status da conexão
  metaConnectedAt: timestamp("meta_connected_at"), // Quando a conexão foi estabelecida
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// Definições de relações
export const userServersRelations = relations(userServers, ({ one }) => ({
  user: one(users, {
    fields: [userServers.userId],
    references: [users.id],
  }),
  server: one(servers, {
    fields: [userServers.serverId],
    references: [servers.id],
  }),
}));

// Relações para servidores
export const serversRelations = relations(servers, ({ many }) => ({
  aiAgents: many(serverAiAgents)
}));

// Relações para agentes de IA
export const serverAiAgentsRelations = relations(serverAiAgents, ({ one, many }) => ({
  server: one(servers, {
    fields: [serverAiAgents.serverId],
    references: [servers.id],
  }),
  userAgents: many(userAiAgents)
}));

// Relações para agentes de IA associados a usuários
export const userAiAgentsRelations = relations(userAiAgents, ({ one }) => ({
  user: one(users, {
    fields: [userAiAgents.userId],
    references: [users.id],
  }),
  agent: one(serverAiAgents, {
    fields: [userAiAgents.agentId],
    references: [serverAiAgents.id],
  }),
}));

// Schemas para inserção
export const insertServerSchema = createInsertSchema(servers).pick({
  name: true,
  ipAddress: true,
  provider: true,
  apiUrl: true,
  apiToken: true,
  n8nApiUrl: true,
  whatsappMetaToken: true,
  whatsappMetaBusinessId: true,
  whatsappMetaApiVersion: true,
  whatsappWebhookUrl: true,
  aiAgentName: true,
  aiAgentWebhookUrl: true, 
  prospectingWebhookUrl: true,
  contactsWebhookUrl: true,
  schedulingWebhookUrl: true,
  crmWebhookUrl: true,
  instanceId: true,
  maxUsers: true,
  active: true,
});

export const insertUserServerSchema = createInsertSchema(userServers).pick({
  userId: true,
  serverId: true,
  isDefault: true,
  metaPhoneNumberId: true,
  metaConnected: true,
  metaConnectedAt: true,
});

export const insertServerAiAgentSchema = createInsertSchema(serverAiAgents).pick({
  serverId: true,
  name: true,
  description: true,
  webhookUrl: true,
  active: true,
});

export const insertUserAiAgentSchema = createInsertSchema(userAiAgents).pick({
  userId: true,
  agentId: true,
  isDefault: true,
});

// ===== NOVA TABELA PARA MENSAGENS ENVIADAS PELO CHAT =====
export const chatMessagesSent = pgTable("chat_messages_sent", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  contactPhone: text("contact_phone").notNull(), // Número do contato (ex: 554391142751)
  message: text("message").notNull(), // Conteúdo da mensagem
  messageType: text("message_type").default("text"), // Tipo: text, image, document, etc.
  metaMessageId: text("meta_message_id"), // ID retornado pela Meta API
  status: text("status").default("sent"), // sent, delivered, read, failed
  createdAt: timestamp("created_at").defaultNow(),
  sentAt: timestamp("sent_at").defaultNow(),
});

// Relação para mensagens enviadas pelo chat
export const chatMessagesSentRelations = relations(chatMessagesSent, ({ one }) => ({
  user: one(users, {
    fields: [chatMessagesSent.userId],
    references: [users.id],
  }),
}));

// Schema para inserção de mensagens do chat
export const insertChatMessageSentSchema = createInsertSchema(chatMessagesSent).pick({
  userId: true,
  contactPhone: true,
  message: true,
  messageType: true,
  metaMessageId: true,
  status: true,
});

// Tipos de conexão para envio de mensagens
export const messageSendingConnectionTypes = ["whatsapp_qr", "whatsapp_meta_api"] as const;
export type MessageSendingConnectionType = (typeof messageSendingConnectionTypes)[number];

// Types
export type Server = typeof servers.$inferSelect;
export type InsertServer = z.infer<typeof insertServerSchema>;

export type UserServer = typeof userServers.$inferSelect;
export type InsertUserServer = z.infer<typeof insertUserServerSchema>;

export type ServerAiAgent = typeof serverAiAgents.$inferSelect;
export type InsertServerAiAgent = z.infer<typeof insertServerAiAgentSchema>;

export type UserAiAgent = typeof userAiAgents.$inferSelect;
export type InsertUserAiAgent = z.infer<typeof insertUserAiAgentSchema>;

// Schema para inserção de contatos
export const insertContactSchema = createInsertSchema(contacts).pick({
  phoneNumber: true,
  name: true,
  profilePicture: true,
  lastMessageTime: true,
  lastMessage: true,
  source: true,
  serverId: true,
  isActive: true,
  notes: true,
  tags: true,
});

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;

// Schemas para os relatórios Meta
export const insertMetaConversationReportSchema = createInsertSchema(metaConversationReports).pick({
  phoneNumberId: true,
  conversationId: true,
  contactNumber: true,
  conversationType: true,
  isFreeWindow: true,
  startedAt: true,
  endedAt: true,
  messageCount: true,
  totalCost: true,
});

export const insertMetaMessageReportSchema = createInsertSchema(metaMessageReports).pick({
  phoneNumberId: true,
  messageId: true,
  contactNumber: true,
  messageType: true,
  templateName: true,
  messageDirection: true,
  deliveryStatus: true,
  errorCode: true,
  errorMessage: true,
  sentAt: true,
  deliveredAt: true,
  readAt: true,
  cost: true,
});

export const insertMetaBillingReportSchema = createInsertSchema(metaBillingReports).pick({
  phoneNumberId: true,
  reportDate: true,
  conversationCount: true,
  freeConversationCount: true,
  paidConversationCount: true,
  messageCount: true,
  templateMessageCount: true,
  totalCost: true,
  currency: true,
});

export const insertMetaLeadResponseReportSchema = createInsertSchema(metaLeadResponseReports).pick({
  phoneNumberId: true,
  contactNumber: true,
  leadSource: true,
  firstMessageAt: true,
  firstResponseAt: true,
  responseTime: true,
  totalMessages: true,
  hasResponse: true,
  leadStatus: true,
});

// Types para os relatórios Meta
export type MetaConversationReport = typeof metaConversationReports.$inferSelect;
export type InsertMetaConversationReport = z.infer<typeof insertMetaConversationReportSchema>;

export type MetaMessageReport = typeof metaMessageReports.$inferSelect;
export type InsertMetaMessageReport = z.infer<typeof insertMetaMessageReportSchema>;

export type MetaBillingReport = typeof metaBillingReports.$inferSelect;
export type InsertMetaBillingReport = z.infer<typeof insertMetaBillingReportSchema>;

export type MetaLeadResponseReport = typeof metaLeadResponseReports.$inferSelect;
export type InsertMetaLeadResponseReport = z.infer<typeof insertMetaLeadResponseReportSchema>;

// Tabela para armazenar mensagens de WhatsApp

