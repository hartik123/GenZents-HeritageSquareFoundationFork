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

### Heritage Domain Knowledge

**Document Management Best Practices**: We studied how heritage organizations actually work, learning about archival principles, metadata standards, and the importance of preserving document integrity. This influenced our version control system and audit logging features.

**User Experience for Non-Technical Users**: Designing for volunteers of varying technical skill levels taught us about progressive disclosure, intuitive navigation, and the importance of providing multiple ways to accomplish the same task.

## How We Built It

### Phase 1: Foundation and Planning (Days 1-10)  
Designed core architecture with Next.js 14, FastAPI, Supabase, and ChromaDB. Created a normalized database schema handling chats, messages, reactions, and file metadata.

### Phase 2: Core Chat Interface (Days 10-20)  
Implemented real-time streaming via WebSockets. Built a rich message system with markdown, reactions, and sharing. Managed state with Zustand for persistence and smooth UX.

### Phase 3: AI Integration and Document Processing (Days 20-40)  
Integrated Google Gemini 2.0 with prompt engineering, OCR, multi-turn context, and error handling. Developed a secure file pipeline with virus scanning, metadata extraction, and tagging. Implemented semantic search using ChromaDB with document chunking and optimized queries.

### Phase 4: Advanced Features (Days 40-50)  
Built asynchronous background task system and git-like version control with full change tracking and rollback. Developed admin dashboard for user roles, monitoring, and analytics.

### Phase 5: Integration and Polish (Days 50-60)  
Completed Google Drive sync with OAuth 2.0, bi-directional sync, and large file handling. Added security layers including JWT auth, row-level security, and input validation.

## The Challenges We Faced

| **Category**              | **Challenge**                                                                 | **Solution**                                                                 |
|---------------------------|-------------------------------------------------------------------------------|------------------------------------------------------------------------------|
| **Real-time Streaming**   | Connection drops, sync issues, memory leaks during AI streaming              | Built robust connection manager with auto-reconnect and fallback            |
| **Large File Handling**   | UI freezing during large PDF processing (100MB+)                             | Used background tasks with real-time progress updates                        |
| **Semantic Search Speed** | Slow embedding and query response times                                      | Applied chunking, caching, and optimized embeddings                          |
| **Heritage Language**     | Archaic terms confused AI, risking historical inaccuracy                     | Custom prompts and context management preserved meaning                      |
| **Non-Technical Users**   | Needed simple, accessible UI for volunteers of all skill levels              | Designed intuitive interfaces, clear guidance, and tested with users         |
| **Google Drive API**      | OAuth, rate limits, permission management challenges                         | Built a resilient API wrapper with error handling and retry logic            |

## Key Learnings and Takeaways

- **AI Integration Needs Depth**: We learned that effective AI requires strong prompt engineering, context handling, and rate/token management—beyond just calling APIs.

- **User Experience is Everything**: Designing with real users in mind helped us build an intuitive, accessible platform that truly solves their problems.

- **Build Fast, Learn Faster**: Iterative development, open communication, and shared ownership allowed us to move quickly and stay aligned as a team.

## What's Next?

Building Archyx AI has been just the beginning of our journey. We see tremendous potential for expanding this platform:

### Immediate Enhancements
- **Mobile Applications**: Native iOS and Android apps for field research
- **Enhanced AI Capabilities**: Custom models trained specifically on heritage content
- **Multi-language Support**: Translation and analysis of historical documents in multiple languages
- **Advanced Analytics**: Insights into collection usage and research patterns

### Long-term Vision
- **Heritage Network**: Connect multiple heritage organizations in a collaborative platform
- **Machine Learning Pipeline**: Automated pattern recognition in historical documents
- **Augmented Reality**: AR features for physical archive management
- **Blockchain Integration**: Document authenticity verification and provenance tracking

### Community Impact
We hope Archyx AI will serve as a model for how technology can be thoughtfully applied to preserve and democratize access to historical knowledge. Our goal is to contribute back to the heritage technology community and help other organizations benefit from similar solutions.

## Acknowledgments

This project wouldn't have been possible without:
- **Heritage Square Foundation**: For trusting us with their important work and providing real-world context
- **2025 Summer Opportunity Hack**: For creating an environment where students can make meaningful impact
- **Open Source Community**: For the incredible tools and libraries that enabled rapid development
- **Our Mentors and Advisors**: For guidance on both technical and domain-specific challenges

Building Archyx AI has been one of the most rewarding experiences of our academic careers. It combined technical challenge with real-world impact, pushing us to grow as developers while contributing to something meaningful. We're excited to see how heritage organizations can use these tools to preserve and share their invaluable collections with the world.

---

*Built during the 2025 Summer Opportunity Hack by the GenZents team for the Heritage Square Foundation.*