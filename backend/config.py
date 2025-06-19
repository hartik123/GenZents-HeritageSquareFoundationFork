import os
from typing import Optional

class Settings:
    # Supabase Configuration
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    
    # Application Settings
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-here")

    # CORS Settings
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")
    
    # Server Settings
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    DEBUG: bool = os.getenv("DEBUG", "True").lower() == "true"
    
    @classmethod
    def validate(cls, raise_on_missing: bool = True):
        """Validate required environment variables"""
        required_vars = ["SUPABASE_URL", "SUPABASE_ANON_KEY"]
        missing_vars = [var for var in required_vars if not getattr(cls, var)]
        
        if missing_vars:
            error_msg = f"Missing required environment variables: {', '.join(missing_vars)}"
            print(f"Warning: {error_msg}")
            print("Please create a .env file with your Supabase credentials:")
            print("SUPABASE_URL=your_supabase_project_url")
            print("SUPABASE_ANON_KEY=your_supabase_anon_key")
            
            if raise_on_missing:
                raise ValueError(error_msg)
            return False
        
        return True
    
    @property
    def is_configured(self) -> bool:
        """Check if minimum configuration is present"""
        return bool(self.SUPABASE_URL and self.SUPABASE_ANON_KEY)

settings = Settings()

# Only validate if we're not in development mode
# This allows the app to start even without env vars for testing
if not settings.DEBUG:
    settings.validate()
