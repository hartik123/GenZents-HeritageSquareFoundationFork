# Archyx AI - Heritage Archive Intelligence Platform

![Project Banner](https://img.shields.io/badge/Opportunity_Hack-2025_Summer-brightgreen)
![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![FastAPI](https://img.shields.io/badge/FastAPI-0.104-009688)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)

## Quick Links
- **Nonprofit Partner**: [Heritage Square Foundation](https://ohack.dev/nonprofit/QFPGmii2GmDPYrv5tjHA)
- **Hackathon Details**: [2025 Summer Opportunity Hack](https://www.ohack.dev/hack/2025_summer)
- **Team Slack Channel**: [#genzents](https://opportunity-hack.slack.com/app_redirect?channel=genzents)
- **DevPost Submission**: [Archyx AI on DevPost](https://devpost.com/submit-to/25595-opportunity-hack-summer-2025-volunteer-internship-hackathon/manage/submissions/743154-archyx-ai/project_details/edit)
- **Demo Video**: [Watch Our Demo](https://youtu.be/8onJQ87hVlE)

## Creator
- **Irtifaur Rahman**

## Team "GenZents"
- **[Aakash Khepar](https://github.com/ak-asu)** 
- **[Hartik Mukesh Suhagiya](https://github.com/hartik123)** 
- **[Manas Dani](https://github.com/manasdani)** 
- **[Vuong Nguyen](https://github.com/vuongnguyen)** 
- **[Waleed Alfar](https://github.com/waleedalfar)** 

## Problem Statement

Heritage organizations like the Heritage Square Foundation face critical challenges in managing their digital archives:

- **Document Inaccessibility**: Historical documents buried in complex file structures
- **Poor Searchability**: Valuable information remains hidden and unfindable
- **Volunteer Frustration**: New volunteers struggle with outdated organization systems
- **Research Inefficiency**: More time spent searching than analyzing content
- **Lost Knowledge**: Important documents effectively "lost" due to poor digital organization

## Our Solution: Archyx AI

Archyx AI transforms heritage archive management by providing an intelligent, conversational interface that makes historical documents as accessible as having a natural conversation. Built specifically for the Heritage Square Foundation, our platform combines cutting-edge AI with practical archival management needs.

### 🎯 Core Capabilities

**🤖 Intelligent Chat Interface**
- ChatGPT-style conversational AI powered by Google Gemini 2.0 Flash
- Real-time streaming responses with contextual understanding
- Multi-modal support for text, images, PDFs, and document attachments
- Message reactions, editing, and comprehensive history management
- Export conversations in multiple formats (JSON, Markdown, TXT)

**📁 Smart Document Organization**
- AI-powered automatic categorization and intelligent tagging
- Document summarization and metadata extraction
- Vector-based semantic search using ChromaDB for meaning-based discovery
- Cross-referencing and relationship mapping between documents
- Command-based file operations using natural language processing

**⚡ Advanced Performance Features**
- Asynchronous background task management for large file operations
- Real-time progress tracking with cancellation capabilities
- Version control system with complete change tracking and rollback
- Google Drive integration with bi-directional synchronization
- Scalable architecture supporting extensive archives and concurrent users

**� Comprehensive User Management**
- Role-based access control (Admin, Researcher, Volunteer user types)
- Shared chat sessions enabling collaborative research
- Personal organization with bookmarks and custom collections
- User invitation system with admin-controlled permissions

**🔒 Enterprise-Grade Security**
- JWT authentication with Supabase integration and automatic refresh
- Row Level Security (RLS) policies ensuring data protection
- Comprehensive input validation and sanitization

## Tech Stack

### Frontend Architecture
- **Framework**: Next.js 14 with App Router for server-side rendering and routing
- **Language**: TypeScript for type-safe development and better maintainability
- **Styling**: Tailwind CSS with Shadcn/ui component library for consistent design
- **State Management**: Zustand with persistence for lightweight, scalable state
- **UI Components**: Shadcn/ui with Lucide React icons for professional interface

### Backend Services
- **Framework**: FastAPI (Python) with async support for high performance , LangChain – used to orchestrate LLM-powered agents and tools for document retrieval, interaction, and automation.
- **AI Integration**: Google Generative AI (Gemini 2.0 Flash) for intelligent responses
- **Vector Database**: ChromaDB for semantic search and document embeddings
- **Background Processing**: Async task queue system for large file operations
- **File Processing**: Multi-format document handling with OCR capabilities
- **APIs**: RESTful APIs with automatic OpenAPI documentation

### Database & Infrastructure
- **Database**: PostgreSQL via Supabase with real-time features
- **Authentication**: Supabase Auth with JWT tokens and refresh mechanisms
- **Storage**: Supabase Storage with virus scanning and file validation
- **Security**: Row Level Security (RLS) policies and comprehensive access control
- **Hosting**: Vercel (Frontend) + Railway (Backend) for scalable deployment
- **Monitoring**: Built-in analytics and comprehensive error tracking

## Project Structure

```
GenZents-HeritageSquareFounda/
├── frontend/                   # Next.js frontend application
│   ├── app/                   # Next.js App Router
│   ├── components/            # React components
│   │   ├── chat/             # Chat interface components
│   │   ├── ui/               # Base UI components
│   │   └── layout/           # Layout components
│   ├── lib/                  # Utilities and services
│   │   ├── stores/           # Zustand state management
│   │   ├── services/         # API and business logic
│   │   ├── types/            # TypeScript definitions
│   │   └── utils/            # Helper functions
│   └── hooks/                # Custom React hooks
├── backend/                   # FastAPI backend services
│   ├── api/                  # API route handlers
│   ├── services/             # Business logic services
│   ├── models/               # Data models and schemas
│   └── main.py              # FastAPI application entry
├── scripts/                  # Database setup and utilities
├── docs/                     # Project documentation
└── README.md                 # This file
```

## Getting Started

### Prerequisites
- **Node.js** 18+ and **pnpm**
- **Python** 3.8+ and **pip**
- **Supabase** account and project
- **Google AI** API key for Gemini integration

### Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env.local

# Configure environment variables
# Edit .env.local with your Supabase and API keys

# Run development server
pnpm dev
```

Visit `http://localhost:3000` to see the frontend application.

### Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment (Windows)
python -m venv .venv
.venv\Scripts\activate

# Create virtual environment (macOS/Linux)
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy environment template
cp .env.example .env

# Configure environment variables
# Edit .env with your Supabase and API keys

# Run development server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Visit `http://localhost:8000/docs` to see the API documentation.

### Database Setup

```bash
# Run the database setup script in Supabase SQL editor
# File: frontend/scripts/setup-database.sql
```

### Environment Variables

**Frontend (.env.local)**
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**Backend (.env)**
```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
GOOGLE_API_KEY=your_google_ai_api_key
```

## Features in Detail

### 🤖 AI-Powered Conversational Interface
- **Natural Language Queries**: Ask questions about entire document collections using everyday language
- **Real-time Streaming**: Get immediate feedback with progressive response generation
- **Context Awareness**: Maintains conversation history and understands follow-up questions
- **Smart Citations**: Automatic source citations with direct links to referenced documents
- **Command Processing**: Execute complex operations using natural language commands like "/organize", "/search", "/backup"

### 📁 Intelligent Document Management
- **AI Categorization**: Automatic classification using Google Gemini 2.0 Flash for heritage-specific content
- **Smart Tagging**: Context-aware tag generation for improved discoverability
- **Metadata Extraction**: Automatic extraction of dates, people, places, and key information
- **Document Relationships**: Discover connections and cross-references between related materials
- **Multi-format Support**: Handle PDFs, images, text files, and scanned documents with OCR

### 🔍 Advanced Search & Discovery
- **Vector Semantic Search**: Find relevant content using meaning and context, not just keywords
- **Traditional Text Search**: Full-text search with highlighting and context snippets
- **Filtered Search**: Search by date ranges, document types, categories, and custom tags
- **Cross-Document Analysis**: Identify patterns and relationships across multiple documents
- **Historical Terminology**: Specialized handling of archaic language and variant spellings

### ⚡ Performance & Background Processing
- **Asynchronous Task System**: Handle large file uploads and processing without blocking the interface
- **Real-time Progress Tracking**: Live updates on long-running operations with cancellation options
- **Batch Operations**: Efficiently process multiple documents simultaneously
- **Resource Optimization**: Smart memory and CPU management for large collections
- **Scalable Architecture**: Support for growing archives and increased user concurrency

### 👥 Collaboration & User Management
- **Role-Based Access**: Three user types (Admin, Researcher, Volunteer) with appropriate permissions
- **Shared Research Sessions**: Collaborative chat sessions for team research projects
- **Personal Organization**: Individual bookmarks, notes, and custom document collections
- **User Invitations**: Admin-controlled invitation system with email notifications
- **Activity Monitoring**: Comprehensive logs of user actions and system usage

### 🔄 Version Control & Data Integrity
- **Document Version Tracking**: Complete history of document changes with timestamps
- **Rollback Capabilities**: Restore previous versions of critical documents when needed
- **Change Visualization**: See exactly what changed between document versions
- **Audit Trails**: Maintain compliance with complete action logging
- **Backup Systems**: Automatic backups with point-in-time recovery options

### 🔗 Integration & Synchronization
- **Google Drive Sync**: Bi-directional synchronization with existing Google Drive collections
- **Conflict Resolution**: Smart handling of simultaneous edits and version conflicts
- **Selective Sync**: Choose specific folders and file types for synchronization
- **Real-time Updates**: Changes reflected immediately across all connected systems
- **API Integration**: RESTful APIs for connecting with existing archival management systems

## Impact & Metrics

### Broader Heritage Community
- Scalable solution for organizations of any size
- Open-source components for community benefit
- Best practices for digital archive management
- Template for AI integration in heritage preservation

## Security & Compliance

- **Authentication**: Secure JWT-based authentication
- **Authorization**: Granular role-based access control
- **Data Protection**: End-to-end encryption and secure storage
- **Privacy**: GDPR-compliant data handling practices
- **Audit Trails**: Complete activity logging and monitoring
- **File Security**: Virus scanning and content validation

## API Documentation

### Frontend APIs
- Basic CRUD operations via Supabase client
- Real-time subscriptions for live updates
- User interface state management
- Analytics and usage tracking

### Backend APIs
- AI message processing and response generation
- Background task management and monitoring
- File operations and document processing
- Advanced search and analytics

## Contributing

We welcome contributions from the community! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details on:

- Code style and conventions
- Pull request process
- Issue reporting and feature requests
- Development environment setup


## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **Heritage Square Foundation** for partnering with us and providing real-world context
- **Opportunity Hack** for organizing this impactful hackathon
- **Google AI** for providing cutting-edge language models
- **Supabase** for the excellent backend-as-a-service platform
- **Open Source Community** for the amazing tools and libraries we built upon

## What's Next

- **Production Deployment** for Heritage Square Foundation
- **Multi-organization Support** for broader heritage community
- **Mobile Applications** for field research and accessibility
- **Advanced AI Features** including custom heritage-trained models
- **Integration Ecosystem** with existing archival management systems

---

**Built with ❤️ by Team GenZents for the 2025 Summer Opportunity Hack**

*Transforming heritage preservation through intelligent technology*
