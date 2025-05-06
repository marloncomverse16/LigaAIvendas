# Architecture Overview

## 1. Overview

This application is a full-stack web platform designed to provide a suite of business tools including WhatsApp messaging integration, AI agent interactions, lead management, prospecting, and user administration. The system follows a modern client-server architecture with a React frontend, Node.js/Express backend, and PostgreSQL database.

The platform is structured as a modular application with various functional areas that can be enabled or disabled for different users. Core capabilities include:

- WhatsApp message management and connectivity
- AI-powered agent for automated customer interactions
- Lead management and tracking
- User administration with granular permissions
- Prospecting and CRM functionality

## 2. System Architecture

The application follows a three-tier architecture:

### Frontend (Client)
- Single-page application built with React
- Component-based UI using shadcn/ui components
- Tailwind CSS for styling
- React Query for data fetching and state management
- Authentication state maintained through React context

### Backend (Server)
- Node.js with Express.js framework
- RESTful API endpoints
- Session-based authentication
- Webhook handling for external service integration
- WebSocket server for real-time communication

### Database
- PostgreSQL database for persistent storage
- Drizzle ORM for database interactions
- Migration system for database schema changes

## 3. Key Components

### Frontend Components

#### Authentication Layer
- Managed through a React context provider (`AuthProvider`)
- Maintains user state across the application
- Handles login, logout, and session persistence

#### UI Framework
- Uses a component library built with Radix UI primitives
- Theme customization support with light/dark mode
- Responsive design with mobile-friendly layouts

#### Routing
- Client-side routing with Wouter library
- Protected routes that require authentication

#### State Management
- React Query for server state
- React Context for global application state
- Form state managed with React Hook Form

### Backend Components

#### Authentication System
- Passport.js for authentication middleware
- Session-based authentication stored in PostgreSQL
- Password hashing using scrypt with salt

#### API Routes
- RESTful endpoints for data operations
- Authenticated routes with middleware protection
- CRUD operations for various resources

#### WebSocket Server
- Real-time communication for chat functionality
- Connection status updates
- Message delivery notifications

#### External Integration
- Webhook handlers for WhatsApp integration
- API clients for external service communication
- File upload handling

### Database Schema

The database schema includes tables for:
- Users and authentication
- Lead management
- AI agent configuration
- Messaging and communications
- Prospecting and search results
- System settings and configurations

## 4. Data Flow

### Authentication Flow
1. User submits credentials to `/api/login` endpoint
2. Server validates credentials and creates a session
3. Session ID is stored in a cookie
4. Subsequent requests include the session cookie for authentication

### WhatsApp Integration Flow
1. User initiates connection through the UI
2. Backend makes a webhook call to the configured WhatsApp service
3. WhatsApp service returns a QR code or connection status
4. User scans QR code with WhatsApp mobile app
5. WhatsApp service notifies backend of successful connection
6. Real-time status updates are pushed to frontend via WebSocket

### AI Agent Interaction Flow
1. User configures AI agent rules and behavior
2. Incoming messages are processed against configured triggers
3. AI agent responds based on configured personality and rules
4. Interactions are logged for analysis and improvement

## 5. External Dependencies

### Frontend Dependencies
- React ecosystem (React, React DOM)
- Tailwind CSS for styling
- shadcn/ui components (based on Radix UI)
- React Query for data fetching
- React Hook Form for form handling
- Zod for validation

### Backend Dependencies
- Express.js for HTTP server and routing
- Passport.js for authentication
- pg (node-postgres) for database connectivity
- Drizzle ORM for database operations
- Multer for file uploads
- WebSocket for real-time communication
- Axios for HTTP requests

### External Services
- WhatsApp API integration through webhooks
- Evolution API for WhatsApp messaging
- n8n for workflow automation (referenced in webhook URLs)

## 6. Deployment Strategy

The application is configured for deployment on Replit, as indicated by the `.replit` configuration file. It supports:

- Development mode with hot reloading
- Production build process
- Autoscaling deployment target

The deployment workflow includes:
1. Building the application with `npm run build`
2. Starting the production server with `npm run start`
3. Serving static assets from the build directory

Database migrations are handled through Drizzle ORM's migration system, allowing for schema version control and safe updates to the database structure.

## 7. Security Considerations

- Passwords are hashed using scrypt with unique salts per user
- Session-based authentication with secure cookies
- API endpoints protected with authentication middleware
- Role-based access control for different modules
- Token-based systems for external API access

## 8. Scalability Considerations

- Stateless API design allows for horizontal scaling
- Database connection pooling for efficient resource usage
- Separated frontend and backend for independent scaling
- Webhook architecture for asynchronous processing