# Replit.md

## Overview

This is a modern full-stack chat application built with React, Express, and PostgreSQL. The application provides an AI-powered conversational interface using OpenAI's GPT models, with a clean, dark-themed UI inspired by professional productivity tools.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The application follows a monorepo structure with clear separation between client, server, and shared code:

- **Frontend**: React-based SPA with TypeScript, using Vite for development and building
- **Backend**: Express.js REST API with TypeScript
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **AI Integration**: OpenAI GPT models for conversational AI capabilities
- **UI Framework**: shadcn/ui components with Tailwind CSS for styling
- **State Management**: TanStack Query for server state management

## Key Components

### Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite
- **Routing**: Wouter for lightweight client-side routing
- **Styling**: Tailwind CSS with custom dark theme variables
- **UI Components**: shadcn/ui component library with Radix UI primitives
- **State Management**: TanStack Query for API state, local React state for UI
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Session-based (infrastructure in place)
- **API Design**: RESTful endpoints for conversations and messages
- **AI Service**: OpenAI integration with conversation history support

### Database Schema
- **Users**: Basic user management with username/password
- **Conversations**: Chat sessions with titles, model selection, and timestamps
- **Messages**: Individual messages with role (user/assistant), content, and metadata
- **Relations**: Proper foreign key relationships between users, conversations, and messages

## Data Flow

1. **User Interaction**: User types message in chat interface
2. **Conversation Management**: Creates new conversation if none exists, or uses existing one
3. **Message Processing**: Stores user message, sends to AI service with conversation history
4. **AI Response**: OpenAI processes request and returns response
5. **Storage**: Assistant response is stored in database
6. **UI Update**: React Query automatically updates UI with new messages

## External Dependencies

### Core Framework Dependencies
- **@neondatabase/serverless**: PostgreSQL database connection
- **drizzle-orm**: Type-safe database ORM
- **openai**: Official OpenAI API client
- **@tanstack/react-query**: Server state management
- **wouter**: Lightweight React routing

### UI Dependencies
- **@radix-ui/***: Accessible UI primitives
- **tailwindcss**: Utility-first CSS framework
- **class-variance-authority**: Component variant management
- **lucide-react**: Icon library

### Development Dependencies
- **vite**: Build tool and dev server
- **typescript**: Type checking
- **tsx**: TypeScript execution for development

## Deployment Strategy

### Development
- **Frontend**: Vite dev server with HMR
- **Backend**: tsx for TypeScript execution with auto-reload
- **Database**: Neon serverless PostgreSQL
- **Environment**: All services run locally with proxy setup

### Production Build
- **Frontend**: Vite builds to `dist/public`
- **Backend**: esbuild bundles server code to `dist/index.js`
- **Deployment**: Single Node.js process serving both API and static files
- **Database**: Drizzle migrations via `db:push` command

### Key Configuration Files
- **drizzle.config.ts**: Database configuration and migration settings
- **vite.config.ts**: Frontend build configuration with path aliases
- **tsconfig.json**: TypeScript configuration with path mapping
- **tailwind.config.ts**: CSS framework configuration with custom theme

The application is designed to be easily deployable on platforms like Replit, with all necessary configuration for both development and production environments.