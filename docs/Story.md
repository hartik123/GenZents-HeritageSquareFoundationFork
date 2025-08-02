# Our Journey: Building Archyx AI for Heritage Square Foundation

## The Inspiration

At first, we overlooked the Heritage Square Foundation’s challenges in Opportunity Hack 2025, considering other projects instead. But soon, we realized that searching for information within a large, unorganized collection of secure documents is much harder than a simple Google search—especially for volunteers and researchers who rely on finding historical files and folders daily.

This inspired us to create a solution accessible to all users, not just those with technical skills, making it easy to gather information from the document storage.

### The "Aha" Moment

We recognized that AI chat is widely used and trusted today, simplifying over 90% of tasks and saving time. Building an AI-based, chat-driven solution would naturally fit into users’ everyday habits, requiring no special commands or training to use.

## What We Learned

Building ArchyxAI was a true Software Development experience from the initial phase and outside the academic projects. Here is whhat we learned

### Technical Learning Curve

**AI Integration Complexity**: We discovered that building of the Web application using the REST API calls is different than buiulding of the AI application. Learned Websocket communciation for streaming responses, handling of the connection drop. Learnt Prompt Engineering, Chat Context management, and the working with the Google Gemini 2.0 flash model.

**Full-Stack Architecture**: We understood the working of frontend state management, backend APIs, database design, and AI services, and dove deep into each of them.
- **Next.js 14 App Router**: Server-side rendering, API routes, and modern React patterns
- **Zustand State Management**: Creating stores that persist across sessions and handle complex async operations
- **FastAPI**: Building high-performance Python APIs
- **Supabase**: Real-time database subscriptions, Row Level Security, and authentication

**Vector Databases and Semantic Search**: Understanding how ChromaDB works for semantic search was particularly challenging. We learned about embeddings, vector similarity, and how to structure data for optimal search performance. This knowledge became crucial for helping users find relevant documents based on meaning rather than just keywords.

## How We Built It

### Phase 1: Planning & Architecture (Days 1–10)
- **System Architecture**: Designed end-to-end flow across front-end, back-end, database, and AI layers. Chose Next.js 14 (Full Stack), FastAPI (Endpoints), Supabase (Auth + DB), and ChromaDB (Vector Search).
- **Schema Design**: Created normalized tables for chats (1:N messages), message reactions (M:N), and Google Drive file metadata (path, name, size, timestamps).

### Phase 2: Core Chat Features (Days 10–20)
- **Real-time Communication**: Integrated WebSocket protocol to stream both user prompts and AI responses seamlessly.
- **Message Engine**: Developed markdown-based rendering, like/dislike reactions, and message sharing within threads.
- **Persistent State Management**: Used Zustand to manage local state across tabs and sessions, with optimistic UI updates for speed.

### Phase 3: AI & Document Pipeline (Days 20–40)
- **Google Gemini 2.0 Integration**: Tuned prompt engineering for heritage use cases. Handled token/window limits, multi-turn chats, and API rate limits.
- **File Processing System**: Built secure pipeline with virus scans, OCR for scanned PDFs, metadata extraction, and intelligent document categorization.
- **Semantic Search**: Used ChromaDB for fast and accurate vector-based search. Implemented chunking, embedding storage, and scoring logic.

### Phase 4: Power Features & Infrastructure (Days 40–50)
- **Async Task Processing**: Designed and implemented background task queues for long-running file operations and AI processing.
- **Versioning System**: Built Git-like version control for files — allowing full change tracking, diff viewing, and rollback.
- **Admin Dashboard**: Created a system monitor and user manager with real-time analytics and role-based access control.

### Phase 5: Integration & Security (Days 50–60)
- **Google Drive Sync**: Integrated bi-directional sync with Drive using OAuth 2.0. Optimized for large file collections and update tracking.
- **Security Implementation**: Applied JWT with refresh tokens, RLS in Supabase, and comprehensive input sanitization across endpoints.

## The Challenges We Faced

| **Category**              | **Challenge**                                                                 | **Solution**                                                                 |
|---------------------------|-------------------------------------------------------------------------------|------------------------------------------------------------------------------|
| **Real-time Streaming**   | Connection drops, sync issues, memory leaks during AI streaming              | Built robust connection manager with auto-reconnect and fallback            |
| **Semantic Search Speed** | Slow embedding and query response times                                      | Applied chunking, caching, and optimized embeddings                          |
| **Heritage Language**     | Archaic terms confused AI, risking historical inaccuracy                     | Custom prompts and context management preserved meaning                      |
| **Google Drive API**      | OAuth, rate limits, permission management challenges                         | Built a resilient API wrapper with error handling and retry logic            |

## Key Learnings and Takeaways

- **AI Integration Needs Depth**: We learned that effective AI requires strong prompt engineering, context handling, and rate/token management—beyond just calling APIs.

- **User Experience is Everything**: Designing with real users in mind helped us build an intuitive, accessible platform that truly solves their problems.

- **Communication, and Ownership is a Key**: Iterative development, open communication, and shared ownership allowed us to move quickly and stay aligned as a team.

## What's Next?

Building Archyx AI has been just the beginning of our journey. We see tremendous potential for expanding this platform:

- **Heritage-Specific AI**: Fine-tuned models and multilingual support  
- **Shared Heritage Network**: A collaborative platform for multiple organizations  

## Acknowledgments

This project wouldn't have been possible without:
- **Heritage Square Foundation**: For trusting us with their important work and providing real-world context
- **2025 Summer Opportunity Hack**: For creating an environment where students can make meaningful impact
- **Our Mentors and Advisors**: For guidance on both technical and domain-specific challenges

Building Archyx AI has been one of the most rewarding experiences of our academic careers. It combined technical challenge with real-world impact, pushing us to grow as developers while contributing to something meaningful. We're excited to see how heritage organizations can use these tools to preserve and share their invaluable collections with the world.

---

*Built during the 2025 Summer Opportunity Hack by the GenZents team for the Heritage Square Foundation.*