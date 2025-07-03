# API Documentation

This document provides comprehensive API documentation for the GenZents Heritage Square Foundation application, covering backend endpoints, frontend API routes, and Supabase integration.

## Table of Contents
- [Authentication](#authentication)
- [Backend APIs](#backend-apis)
- [Frontend API Routes](#frontend-api-routes)
- [Supabase Integration](#supabase-integration)
- [Environment Variables](#environment-variables)
- [Error Handling](#error-handling)

## Authentication

All API endpoints require Bearer token authentication using Supabase JWT tokens.

**Header Format:**
```
Authorization: Bearer <supabase_jwt_token>
```

## Backend APIs (Computation-Heavy)

Base URL: `http://127.0.0.1:8000` (development)

These APIs handle complex operations requiring AI processing, file operations, or long-running tasks.

### Messages AI Processing
**Prefix:** `/api/messages`

#### Create Message with AI Response
```http
POST /api/messages/chat/{chat_id}
```
**Description:** Processes user message, generates AI response using LLM, handles command extraction and processing
**Request Body:**
```json
{
  "content": "string",
  "role": "user"
}
```

**Response:**
```json
{
  "id": "string",
  "chat_id": "string",
  "role": "assistant",
  "content": "string",
  "created_at": "datetime",
  "metadata": {
    "model": "string",
    "enhanced_context": "boolean",
    "context_summary_updated": "boolean"
  }
}
```

#### Stream AI Response
```http
POST /api/messages/chat/{chat_id}/stream
```
**Description:** Real-time streaming AI response generation with Server-Sent Events
**Request Body:**
```json
{
  "content": "string",
  "role": "user"
}
```
**Response:** Server-Sent Events stream

### Tasks Long-Running Operations
**Prefix:** `/api/tasks`

#### Create Background Task
```http
POST /api/tasks/
```
**Description:** Creates background tasks for file organization, search, cleanup operations
**Request Body:**
```json
{
  "type": "organize|search|cleanup|folder_operation|backup|analysis",
  "command": "string",
  "chat_id": "string",
  "priority": "integer",
  "parameters": "object",
  "estimated_duration": "integer",
  "max_retries": "integer"
}
```

#### Cancel Running Task
```http
POST /api/tasks/{task_id}/cancel
```
**Description:** Cancels actively running background operations
**Request Body:**
```json
{
  "reason": "string"
}
```

#### Process Command as Task
```http
POST /api/tasks/process-command
```
**Description:** Processes complex commands as long-running background tasks
**Request Body:**
```json
{
  "command": "string",
  "chat_id": "string",
  "priority": "integer"
}
```

### Drive Agent API
**Description:** File system operations, Google Drive integration, document processing (endpoints to be documented)

## Frontend API Routes (Polling/Monitoring/CRUD)

Base URL: Frontend domain

These APIs handle simple data operations, real-time monitoring, and user interface state management through Next.js API routes.

### Chats Management
```http
GET /api/chats
```
**Description:** Fetch user's chats with filtering (Direct Supabase query)
**Query Parameters:**
- `archived` (boolean) - Filter archived chats
- `bookmarked` (boolean) - Filter bookmarked chats
- `limit` (integer) - Number of chats to return

```http
POST /api/chats
```
**Description:** Create new chat (Direct Supabase insert)
**Request Body:**
```json
{
  "title": "string",
  "model": "string",
  "system_prompt": "string",
  "tags": ["string"]
}
```

```http
PUT /api/chats/{chat_id}
```
**Description:** Update chat metadata - title, archived, bookmarked status (Direct Supabase update)
**Request Body:**
```json
{
  "title": "string",
  "archived": "boolean",
  "bookmarked": "boolean"
}
```

```http
DELETE /api/chats/{chat_id}
```
**Description:** Delete chat and associated messages (Direct Supabase delete)

### Messages Fetching
```http
GET /api/messages/chat/{chat_id}
```
**Description:** Retrieve chat message history with pagination (Direct Supabase query)
**Query Parameters:**
- `limit` (integer) - Messages per page
- `offset` (integer) - Pagination offset

```http
GET /api/messages/{message_id}
```
**Description:** Get specific message details (Direct Supabase query)

```http
PUT /api/messages/{message_id}
```
**Description:** Update message content or metadata (Direct Supabase update)
**Request Body:**
```json
{
  "content": "string"
}
```

```http
DELETE /api/messages/{message_id}
```
**Description:** Delete specific message (Direct Supabase delete)

### Tasks Monitoring
```http
GET /api/tasks
```
**Description:** Monitor task status and progress (Direct Supabase query)
**Query Parameters:**
- `status` (string) - Filter by task status
- `task_type` (string) - Filter by task type
- `page` (integer) - Page number
- `per_page` (integer) - Items per page

**Response:**
```json
{
  "tasks": [
    {
      "id": "string",
      "type": "string",
      "command": "string",
      "status": "pending|running|completed|failed|cancelled",
      "progress": "integer",
      "created_at": "datetime",
      "estimated_duration": "integer"
    }
  ],
  "pagination": {
    "total": "integer",
    "page": "integer",
    "per_page": "integer",
    "has_next": "boolean",
    "has_prev": "boolean"
  }
}
```

```http
GET /api/tasks/{task_id}
```
**Description:** Get detailed task information including logs and results (Direct Supabase query)

```http
PUT /api/tasks/{task_id}
```
**Description:** Update task metadata only - not computational operations (Direct Supabase update)
**Request Body:**
```json
{
  "status": "string",
  "progress": "integer",
  "result": "object",
  "error_message": "string"
}
```

```http
DELETE /api/tasks/{task_id}
```
**Description:** Delete completed/failed tasks (Direct Supabase delete)

### Analytics & Monitoring
```http
GET /api/analytics/usage
```
**Description:** Get usage statistics (Direct Supabase aggregation queries)
**Response:**
```json
{
  "total_chats": "integer",
  "total_messages": "integer",
  "total_tasks": "integer",
  "active_tasks": "integer"
}
```

### AI Processing Proxy
```http
POST /api/chat
```
**Description:** Proxy for AI message processing (forwards to backend)
**Request Body:**
```json
{
  "chatId": "string",
  "message": "string"
}
```

**Response:** Proxied response from backend messages API

## Supabase Integration

### Database Tables

#### Chats Table
- Primary table for chat records
- Accessed via: `supabase.from("chats")`

#### Messages Table
- Stores chat messages
- Accessed via: `supabase.from("messages")`

#### Tasks Table
- Task management records
- Accessed via: `supabase.from("tasks")`

### Authentication Methods

#### Get Current User
```typescript
const { data: { user }, error } = await supabase.auth.getUser()
```

#### Get Session
```typescript
const { data: sessionData } = await supabase.auth.getSession()
```

### Analytics Queries

#### Usage Metrics
```typescript
const [{ count: totalChats }, { count: totalMessages }] = await Promise.all([
  supabase.from("chats").select("*", { count: "exact", head: true }),
  supabase.from("messages").select("*", { count: "exact", head: true }),
])
```

## Environment Variables

### Required Variables
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Backend Configuration
BACKEND_URL=http://127.0.0.1:8000
```

## Error Handling

### Standard Error Response Format
```json
{
  "error": {
    "code": "string",
    "message": "string",
    "details": "object"
  }
}
```

### Common HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

### Authentication Errors
- `401` - Missing or invalid JWT token
- `403` - Insufficient permissions

### Validation Errors
- `400` - Invalid request body or parameters
- `422` - Validation failed

## Security

### Content Security Policy
The application implements CSP headers allowing connections to:
- `'self'`
- `https://api.openai.com`
- `https://api.anthropic.com`
- `https://*.supabase.co`
- `wss://*.supabase.co`

### Rate Limiting
Rate limiting is implemented on all API endpoints to prevent abuse.

### Input Validation
All endpoints implement proper input validation and sanitization.

## API Architecture

### Backend vs Frontend API Separation

**Backend APIs (Computation-Heavy):**
- AI/LLM processing and response generation
- File operations and Google Drive integration
- Long-running background tasks
- Command processing and execution
- Complex data transformations

**Frontend APIs (Polling/Monitoring/CRUD):**
- Simple database CRUD operations
- Real-time status monitoring
- User interface state management
- Data fetching with pagination
- Analytics and usage metrics

### Implementation Pattern for Frontend API Routes

All frontend API routes follow this authentication and proxy pattern:

```typescript
// Example: /app/api/chats/route.ts
export async function GET(request: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // For simple operations: Direct Supabase query
  const { data, error: dbError } = await supabase
    .from('chats')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return NextResponse.json({ chats: data })
}

// For complex operations: Proxy to backend
export async function POST(request: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token

  const response = await fetch(`${process.env.BACKEND_URL}/api/messages/chat/${chatId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(requestBody)
  })

  return NextResponse.json(await response.json())
}
```

## Required Frontend API Route Implementations

### Simple CRUD Operations (Direct Supabase)
These routes should directly query Supabase without backend proxy:

1. **`/app/api/chats/route.ts`** - GET (list chats), POST (create chat)
2. **`/app/api/chats/[chatId]/route.ts`** - GET, PUT, DELETE for individual chat operations
3. **`/app/api/messages/[chatId]/route.ts`** - GET for message history fetching
4. **`/app/api/messages/[messageId]/route.ts`** - GET, PUT, DELETE for message operations
5. **`/app/api/tasks/route.ts`** - GET for task monitoring and status polling
6. **`/app/api/tasks/[taskId]/route.ts`** - GET, PUT, DELETE for task management
7. **`/app/api/analytics/usage/route.ts`** - GET for usage metrics and analytics

### Computation Proxy Routes (Backend Proxy)
These routes should proxy to backend for complex operations:

1. **`/app/api/chat/route.ts`** ✅ (Already exists) - POST for AI message processing
2. **`/app/api/tasks/create/route.ts`** - POST for creating background tasks (proxy to `/api/tasks/`)
3. **`/app/api/tasks/[taskId]/cancel/route.ts`** - POST for task cancellation (proxy to `/api/tasks/{task_id}/cancel`)
4. **`/app/api/tasks/process-command/route.ts`** - POST for command processing (proxy to `/api/tasks/process-command`)
5. **`/app/api/drive/route.ts`** - All methods for file operations (when implemented)

### Real-time Features
- **Server-Sent Events** for task progress monitoring
- **WebSocket connections** for real-time chat updates (if needed)