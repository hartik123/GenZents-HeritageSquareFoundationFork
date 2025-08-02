# Our Journey: Building Archyx AI for Heritage Square Foundation

## The Inspiration

When we first learned about the Heritage Square Foundation's challenge during the 2025 Summer Opportunity Hack, it struck a deep chord with our team. As computer science students, we often take for granted how easily we can search through vast amounts of digital information. But imagining volunteers and researchers struggling to find crucial historical documents buried in poorly organized digital archives painted a clear picture of frustration and lost potential.

The more we learned about heritage organizations, the more we realized this wasn't just a technical problem—it was about preserving history, honoring the past, and making knowledge accessible to future generations. The thought that important historical insights might be locked away simply because documents were hard to find felt unacceptable. We wanted to build something that would not only solve technical challenges but also democratize access to historical knowledge.

### The "Aha" Moment

Our breakthrough came when we realized that people are already comfortable with ChatGPT-style interfaces. Instead of forcing volunteers to learn complex archival systems, why not bring the documents to where people already feel comfortable—a conversational AI interface? This insight shaped our entire approach: make the interaction as natural as asking a knowledgeable librarian for help.

## What We Learned

Building Archyx AI was an intensive learning experience that pushed us far beyond our academic comfort zones. Here are the key areas where we grew:

### Technical Learning Curve

**AI Integration Complexity**: We quickly discovered that building a production-ready AI chat interface is vastly different from simple API calls. Implementing real-time streaming responses required us to master WebSocket connections, handle connection drops gracefully, and manage state across streaming chunks. We learned about prompt engineering, context management, and the nuances of working with Google Gemini 2.0 Flash.

**Full-Stack Architecture**: This project demanded we understand how frontend state management, backend APIs, database design, and AI services all work together. We dove deep into:
- **Next.js 14 App Router**: Server-side rendering, API routes, and modern React patterns
- **Zustand State Management**: Creating stores that persist across sessions and handle complex async operations
- **FastAPI**: Building high-performance Python APIs with automatic documentation and async support
- **Supabase**: Real-time database subscriptions, Row Level Security, and authentication

**Vector Databases and Semantic Search**: Understanding how ChromaDB works for semantic search was particularly challenging. We learned about embeddings, vector similarity, and how to structure data for optimal search performance. This knowledge became crucial for helping users find relevant documents based on meaning rather than just keywords.

### Heritage Domain Knowledge

**Document Management Best Practices**: We studied how heritage organizations actually work, learning about archival principles, metadata standards, and the importance of preserving document integrity. This influenced our version control system and audit logging features.

**User Experience for Non-Technical Users**: Designing for volunteers of varying technical skill levels taught us about progressive disclosure, intuitive navigation, and the importance of providing multiple ways to accomplish the same task.

### Real-World Software Development

**Scalability Considerations**: We learned to think about performance from day one, implementing background task processing, database indexing, and efficient file handling. The asynchronous task system was particularly educational—handling large file uploads and processing operations without blocking the user interface.

**Security and Compliance**: Working with historical documents meant understanding data protection, implementing proper authentication, and building audit trails. We learned about Row Level Security in PostgreSQL, JWT token management, and secure file handling.

## How We Built It

### Phase 1: Foundation and Planning (Days 1-2)

**Architecture Design**: We started by mapping out the core user journeys and identifying the main technical challenges. Early decisions included:
- Choosing Next.js 14 for its full-stack capabilities and excellent developer experience
- Selecting FastAPI for the backend due to its async support and automatic documentation
- Using Supabase for real-time capabilities and built-in authentication
- Implementing ChromaDB for vector-based semantic search

**Database Schema Design**: We designed a normalized schema that could handle complex relationships between chats, messages, files, and users while maintaining performance. Special attention was paid to audit trails and version control requirements.

**UI/UX Prototyping**: Using Figma, we created wireframes that prioritized simplicity and familiarity. The ChatGPT-style interface was central, but we also planned for admin dashboards and task management interfaces.

### Phase 2: Core Chat Interface (Days 3-5)

**Real-time Streaming Implementation**: This was our first major technical challenge. We implemented:
- WebSocket connections for real-time communication
- Chunked response handling for streaming AI responses
- Connection recovery and error handling
- State synchronization across multiple browser tabs

**Message Management System**: We built a comprehensive message system supporting:
- Rich text rendering with markdown support
- File attachments with drag-and-drop upload
- Message reactions and editing capabilities
- Export functionality in multiple formats

**State Management**: Using Zustand, we created a robust state management system that persists across sessions and handles optimistic updates for better user experience.

### Phase 3: AI Integration and Document Processing (Days 6-8)

**Google Gemini Integration**: Integrating Google Gemini 2.0 Flash required understanding:
- Prompt engineering for heritage-specific contexts
- File processing and OCR capabilities
- Context management for multi-turn conversations
- Error handling for API rate limits and failures

**File Processing Pipeline**: We built a comprehensive file processing system:
- Virus scanning for security
- Automatic OCR for scanned documents
- Metadata extraction and analysis
- Intelligent categorization and tagging

**Vector Search Implementation**: ChromaDB integration for semantic search involved:
- Document chunking strategies for optimal search
- Embedding generation and storage
- Query optimization for fast results
- Relevance scoring and result ranking

### Phase 4: Advanced Features (Days 9-11)

**Background Task System**: One of our most complex implementations was the asynchronous task processor:

**Version Control System**: We implemented a git-like system for documents:
- Complete change tracking with diffs
- Rollback capabilities
- Branch-like functionality for collaborative editing
- Audit trails for compliance

**Admin Dashboard**: Building the admin interface taught us about:
- User management and role-based access control
- System monitoring and analytics
- Bulk operations and data management
- Real-time system health monitoring

### Phase 5: Integration and Polish (Days 12-14)

**Google Drive Sync**: The Google Drive integration was particularly challenging:
- OAuth 2.0 flow implementation
- Bi-directional synchronization
- Conflict resolution for simultaneous edits
- Efficient handling of large file collections

**Security Implementation**: We implemented comprehensive security measures:
- JWT authentication with refresh tokens
- Row Level Security policies in the database
- Input sanitization and validation
- Comprehensive audit logging

**Performance Optimization**: Final optimizations included:
- Database query optimization and indexing
- Frontend bundle optimization
- Caching strategies for frequently accessed data
- Memory management for large file operations

## The Challenges We Faced

### Technical Challenges

**Real-time Streaming Complexity**: Getting AI responses to stream smoothly while maintaining conversation context was incredibly complex. We faced issues with:
- Connection drops during long responses
- State synchronization across multiple browser tabs
- Memory leaks from unclosed streams
- Error recovery and graceful degradation

*Solution*: We implemented a robust connection management system with automatic reconnection, proper cleanup of resources, and fallback mechanisms for when streaming fails.

**Large File Processing**: Handling large heritage document collections without blocking the user interface was a major challenge. Processing 100+ MB PDF files could take minutes, and we needed to:
- Keep the UI responsive during processing
- Provide meaningful progress updates
- Handle processing failures gracefully
- Support concurrent operations

*Solution*: Our background task system with real-time progress updates solved this problem. Users can continue using the application while large operations run in the background.

**Vector Search Performance**: Making semantic search fast enough for real-time use while maintaining accuracy was difficult. We struggled with:
- Slow embedding generation for large documents
- Query response times over 2-3 seconds
- Memory usage with large vector collections
- Balancing accuracy with speed

*Solution*: We implemented document chunking strategies, optimized our embedding approach, and added intelligent caching to achieve sub-second search times.

### Domain-Specific Challenges

**Heritage Document Terminology**: Historical documents use archaic language and domain-specific terminology that standard AI models sometimes struggle with. We needed to:
- Train the AI to understand historical context
- Handle variant spellings and old-style writing
- Maintain historical accuracy in responses
- Recognize relationships between historical entities

*Solution*: We developed specialized prompts and context management that helps the AI understand heritage-specific language and maintains historical accuracy.

**User Experience for Non-Technical Users**: Designing for volunteers with varying technical skill levels required us to:
- Hide complexity behind simple interfaces
- Provide multiple ways to accomplish tasks
- Offer clear feedback and guidance
- Ensure accessibility across devices and abilities

*Solution*: We focused on progressive disclosure, comprehensive onboarding, and extensive user testing with heritage volunteers.

### Integration Challenges

**Google Drive API Complexity**: The Google Drive integration was far more complex than expected:
- OAuth 2.0 flow with proper scope management
- Handling rate limits and API quotas
- Managing permissions across shared folders
- Dealing with file type restrictions and formatting

*Solution*: We built a robust abstraction layer around the Google Drive API with comprehensive error handling and retry logic.

**Database Performance**: As our data grew, we encountered performance issues:
- Slow queries on message history
- Concurrent access conflicts
- Real-time subscription performance
- Database connection pooling

*Solution*: We implemented proper indexing, optimized queries, and used connection pooling to maintain performance at scale.

### Team and Process Challenges

**Coordination Across Full Stack**: With team members working on frontend, backend, and AI components simultaneously, coordination was crucial:
- API contract changes affecting multiple developers
- Database schema updates requiring migration coordination
- Feature dependencies creating development bottlenecks
- Testing integration points across services

*Solution*: We established clear API contracts early, used feature flags for safer deployments, and implemented comprehensive integration testing.

**Time Management**: Balancing feature development with polish and testing in a limited timeframe:
- Deciding which features to include vs. which to defer
- Ensuring core functionality was robust vs. adding flashy features
- Allocating time for proper testing and bug fixes
- Managing scope creep as we discovered new requirements

*Solution*: We prioritized ruthlessly, focusing on core user journeys first and adding advanced features only after the foundation was solid.

## Key Learnings and Takeaways

### Technical Insights

**Real-time Systems Are Complex**: Building a real-time, multi-user application taught us immense respect for the complexity of state management, error handling, and performance optimization in distributed systems.

**AI Integration Is More Than API Calls**: Working with AI services requires understanding prompt engineering, context management, token limits, rate limiting, and graceful degradation when services are unavailable.

**User Experience Drives Architecture**: The best technical architecture is useless if the user experience isn't intuitive. We learned to start with user journeys and build technology to support them, not the other way around.

### Product Development Lessons

**Start with the User**: Every technical decision we made was validated against whether it would improve the volunteer and researcher experience. This user-first approach prevented us from over-engineering solutions.

**Iterative Development Works**: Building in short cycles, getting feedback early, and iterating quickly allowed us to course-correct before investing too much time in any single approach.

**Simplicity Is Hard**: Making complex archival operations feel simple required more engineering effort than building complex interfaces. The most intuitive features often had the most sophisticated implementations behind them.

### Team and Collaboration

**Communication Is Everything**: Regular standups, clear documentation, and open communication channels were essential for coordinating work across the full stack.

**Shared Ownership**: Having team members understand and contribute to multiple parts of the system created better solutions and prevented silos.

**Celebrate Small Wins**: Acknowledging progress on complex features kept morale high during challenging implementation phases.

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