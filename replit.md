# LigAI Dashboard - Projeto de Gestão de Leads WhatsApp

## Overview

LigAI Dashboard is an interactive Portuguese dashboard designed for managing WhatsApp leads and business operations. It features a comprehensive authentication system, multi-tenancy, and integration with both WhatsApp Business Cloud API and Evolution API. The project aims to provide an intelligent platform for lead management, prospecting, automated messaging, and AI agent integration, enhancing business communication and efficiency.

**Key Capabilities:**
- Full authentication system (login/registration)
- Main dashboard with business metrics
- Lead management with smart recommendations
- Prospecting module with CSV/Excel upload
- WhatsApp message sending system
- Dual connectivity: QR Code (Evolution API) and Meta Cloud API
- AI agent management with custom behaviors
- Meta API reports with costs in BRL
- Goal setting and performance tracking system
- Media upload (PDF/CSV) with server storage
- Complete multi-tenant data isolation
- Automated WhatsApp Cloud webhook forwarding to AI agents

## User Preferences

### Communication
- **Idioma**: Português brasileiro em todas as respostas
- **Estilo**: Direto, técnico quando necessário, sem emojis excessivos
- **Feedback**: Sempre confirmar quando tarefas importantes são concluídas

### Development
- **Padrão**: TypeScript strict, Drizzle ORM, isolamento multi-tenant
- **Segurança**: Validação rigorosa de dados, sanitização de inputs
- **Performance**: Queries otimizadas, cache quando apropriado
- **Logs**: Detalhados para debugging, especialmente webhooks e APIs

## System Architecture

The LigAI Dashboard is built with a robust, multi-tenant architecture to ensure data isolation and scalability.

**Core Data Structures:**
- **Users**: Authentication system with roles (admin/user).
- **Servers**: WhatsApp API configurations (Evolution/Meta).
- **Leads**: Contact and prospecting management.
- **AI Agents**: Behavior and webhook configurations.
- **Reports**: Meta API and Evolution API metrics.
- **Messages**: WhatsApp communication history.
- **CRM Leads**: Detailed lead management with status and activity history.

**Technology Stack:**
- **Frontend**: React, TypeScript, TailwindCSS, shadcn/ui.
- **Backend**: Express.js, TypeScript, Drizzle ORM.
- **Database**: PostgreSQL with multi-tenant isolation.
- **Authentication**: Passport.js with sessions.
- **APIs**: WhatsApp Business Cloud API, Evolution API.
- **File Upload**: Multer for local storage.
- **Real-time Communication**: WebSocket.

**Architectural Decisions & Features:**
- **Multi-tenancy**: Complete data isolation per user across all tables, including server and AI agent configurations.
- **Automated WhatsApp Webhook Processing**:
    - Automatic forwarding of WhatsApp Cloud messages to specific AI agents.
    - User identification within webhook payloads (user_id, user_name, user_username, and custom headers) for personalized context.
    - Dynamic retrieval of user-specific AI agents based on `phone_number_id` and `server_ai_agents` associations.
    - Dedicated `cloudWebhookUrl` for Cloud API messages, with fallback to general `webhookUrl`.
- **CRM System**:
    - Robust lead management with 6 distinct stages (`sendo_atendido_ia`, `finalizado_ia`, `precisa_atendimento_humano`, `transferido_humano`, `finalizado_humano`, `abandonado`).
    - Comprehensive lead activity tracking and history.
    - API endpoints for lead listing, detail, creation, update, transfer, and statistics, all with multi-tenant isolation.
    - Frontend interface for CRM dashboard, filtering, listing, and detailed views.
- **Message Scheduling**:
    - Robust scheduling system for Meta API messages using a periodic scheduler to ensure execution even with server restarts.
    - Dual sending system (immediate vs. scheduled) with status tracking.
- **QR Code Tracking**:
    - Automatic synchronization and tracking of messages sent via QR Code (Evolution API).
    - Integration of QR code messages into `contacts` table with `source = 'qr_code'`.
    - Automated webhook notification upon QR code generation and connection status changes, with dynamic URL retrieval.
- **Data Management & Reporting**:
    - Dynamic report generation for Meta API (conversations, messages, billing, leads) and QR Code (conversations, messages, contacts) with consistent multi-tenant isolation.
    - Pagination implemented across prospecting, contacts, and all report tables for improved performance and user experience.
    - Real-time result counting for statistics and searches.
- **UI/UX**:
    - Responsive layout optimized for various screen sizes, including detailed configuration pages.
    - Consistent orange-yellow gradient theme for buttons and interactive elements.
    - Simplified interfaces by removing redundant fields and sections (e.g., auto-scheduling, auto-CRM movement from AI agents, certain profile fields).
    - User profile image upload and management.
    - Consistent branding ("LigAI") across the application.
- **System Maintenance**:
    - Robust user deletion process handling complex foreign key dependencies.
    - Optimized server balancing algorithm to prioritize utilization of existing servers.
    - Automated cleanup of message sending history after 90 days.
    - Excel export functionality for users and CRM leads.
- **VPS Deployment**:
    - Complete automated installation system for Ubuntu/Debian VPS servers with root user support.
    - Intelligent database detection - checks for existing databases and allows user to choose between using existing or creating new.
    - Automated subdomain configuration with HTTPS/SSL (Let's Encrypt).
    - PostgreSQL database setup with prompted credentials and existing database preservation.
    - Nginx reverse proxy with security headers and optimization.
    - Production optimizations including caching, compression, and monitoring.
    - Systemd service configuration with automatic startup and proper user management.
    - Comprehensive update system with backup/rollback functionality via update-ligai.sh.
    - Three-tier deployment approach: main installer, production optimizations, and dedicated update script.
    - Security hardening with Fail2ban and firewall configuration.

## External Dependencies

- **WhatsApp Business Cloud API (Meta)**: For direct WhatsApp message sending and business integrations.
- **Evolution API**: For WhatsApp QR code generation, connection management, and real-time messaging via QR.
- **PostgreSQL**: Primary database for all persistent data storage.
- **Cloudinary**: (Implicitly, as media upload is mentioned) For managing and storing uploaded media files.
- **Passport.js**: Authentication library.
- **Multer**: Middleware for handling `multipart/form-data`, primarily for file uploads.
- **XLSX**: Library for generating Excel (.xlsx) files for data export.