This is the backend API server supporting the frontend application. It handles computation-heavy operations including AI processing, file management, and long-running background tasks.

## Features
- Secure API endpoints with Supabase authentication
- AI message processing with LLM integration (OpenAI, Anthropic)
- Background task management for long-running operations
- Real-time streaming AI responses with Server-Sent Events
- File system operations and Google Drive integration
- Command extraction and processing
- RESTful API design with automatic documentation

## Tech Stack
- **FastAPI**: Modern, fast web framework for building APIs
- **Supabase**: Backend-as-a-Service for database and authentication
- **Pydantic**: Data validation using Python type annotations
- **OpenAI**: GPT models integration
- **Anthropic**: Claude models integration

## Setup

### Prerequisites
- Python 3.8 or higher
- Supabase account and project
- OpenAI API key (optional)
- Anthropic API key (optional)

### Installation

1. Clone the repository and navigate to the backend directory
```bash
cd backend
```

2. Run the startup script (automatically creates venv and installs dependencies):

**For Windows:**
```bash
start.bat
```

**For Linux/Mac:**
```bash
chmod +x start.sh
./start.sh
```

**Manual Setup:**
```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env
```

3. Configure environment variables in `.env`:
```env
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

4. Start the development server:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## API Documentation

Once the server is running, you can access:
- **API Documentation**: http://localhost:8000/docs (Swagger UI)
- **Alternative Docs**: http://localhost:8000/redoc (ReDoc)
- **Health Check**: http://localhost:8000/health

## API Endpoints

### Authentication
All endpoints require Bearer token authentication via Supabase JWT.

### Messages AI Processing
**Prefix:** `/api/messages`

- `POST /api/messages/chat/{chat_id}` - Process user message and generate AI response
- `POST /api/messages/chat/{chat_id}/stream` - Real-time streaming AI response generation
- `GET /api/messages/{message_id}` - Get a specific message
- `PUT /api/messages/{message_id}` - Update a message
- `DELETE /api/messages/{message_id}` - Delete a message

### Tasks Long-Running Operations
**Prefix:** `/api/tasks`

- `POST /api/tasks/` - Create background tasks for file operations, search, cleanup
- `GET /api/tasks/{task_id}` - Get task status and progress
- `POST /api/tasks/{task_id}/cancel` - Cancel actively running background operations
- `POST /api/tasks/process-command` - Process complex commands as background tasks

### Drive Agent API
**Prefix:** `/api/drive`

File system operations, Google Drive integration, and document processing (endpoints in development)

## Backend vs Frontend API Architecture

This backend handles **computation-heavy operations**:
- AI/LLM processing and response generation
- File operations and Google Drive integration
- Long-running background tasks
- Command processing and execution
- Complex data transformations

**Frontend APIs** handle simple operations:
- Basic CRUD operations (direct Supabase queries)
- Real-time status monitoring
- User interface state management
- Data fetching with pagination
- Analytics and usage metrics

## Database Schema

The backend uses Supabase with the following main tables:
- `chats` - Chat conversations
- `messages` - Individual messages within chats
- `tasks` - Background task management
- `usage_logs` - AI API usage tracking
- `analytics` - User analytics events

## Security
- JWT token authentication via Supabase
- Row Level Security (RLS) policies
- API key protection for AI services
- CORS configuration for frontend integration
- Content Security Policy for external API connections
- Rate limiting on all endpoints
- Input validation and sanitization

## Development

### Project Structure
```
backend/
├── main.py              # FastAPI application entry point
├── routers/             # API route handlers
│   ├── __init__.py
│   ├── messages.py      # AI message processing endpoints
│   ├── tasks.py         # Background task management
│   ├── drive.py         # File operations and Google Drive
│   └── analytics.py     # Analytics endpoints
├── requirements.txt     # Python dependencies
├── .env.example        # Environment variables template
├── start.sh            # Linux/Mac startup script
└── start.bat           # Windows startup script
```

### Error Handling
Standard error response format:
```json
{
  "error": {
    "code": "string",
    "message": "string",
    "details": "object"
  }
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

### Contributing
1. Follow PEP 8 style guidelines
2. Add type hints for all functions
3. Include proper error handling
4. Test endpoints using the built-in docs
5. Implement input validation for all endpoints

## License
MIT