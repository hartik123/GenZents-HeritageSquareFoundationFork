from supabase import create_client, Client
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from models.user import User
from config import settings

# Initialize clients
supabase: Client = None
if settings.is_configured:
    try:
        supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
        print("✅ Supabase client initialized successfully")
    except Exception as e:
        print(f"❌ Failed to initialize Supabase client: {e}")
        print("Please check your SUPABASE_URL and SUPABASE_ANON_KEY in .env file")
        supabase = None
else:
    print("⚠️  Supabase not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY in .env file")

security = HTTPBearer()

# Dependency to get current user
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    if not supabase:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service not configured"
        )
    
    token = credentials.credentials
    try:
        # Verify JWT token with Supabase
        response = supabase.auth.get_user(token)
        if response.user:
            return User(id=response.user.id, email=response.user.email)
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials"
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
