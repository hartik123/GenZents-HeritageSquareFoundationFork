from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from dotenv import load_dotenv
from config import settings

# Load environment variables
load_dotenv()

# Import routers
from routers import chats, messages

# Initialize FastAPI app
app = FastAPI(
    title="GenZents Heritage Square API",
    description="Backend API for the GenZents Heritage Square chat application",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000", "https://your-frontend-domain.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check endpoint
@app.get("/")
async def root():
    return {"message": "GenZents Heritage Square API is running"}

# Include routers
app.include_router(chats.router)
app.include_router(messages.router)

if __name__ == "__main__":
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
