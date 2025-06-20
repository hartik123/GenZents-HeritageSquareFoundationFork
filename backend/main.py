from api import chats, messages
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from dotenv import load_dotenv
from config import settings
from utils.logger import logger

# import sys
# from pathlib import Path

# # Add the parent directory to the path so we can import our modules
# sys.path.append(str(Path(__file__).parent))

# Load environment variables
load_dotenv()

# Import routers

# Initialize FastAPI app
app = FastAPI(
    title="Archyx AI API",
    description="Backend API for the Archyx AI chat application",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000",
                   "https://your-frontend-domain.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check endpoint


@app.get("/")
async def root():
    logger.info("Health check endpoint accessed")
    return {"message": "Archyx AI API is running"}

# Include routers
app.include_router(chats.router)
app.include_router(messages.router)

if __name__ == "__main__":
    logger.info(f"Starting Archyx AI API on {settings.HOST}:{settings.PORT}")
    uvicorn.run("main:app", host=settings.HOST,
                port=settings.PORT, reload=settings.DEBUG)
