"""
Backend Models - Computation-Heavy Operations Only

This package contains Pydantic models for backend API operations following the
documented API architecture where:

- Frontend API routes handle simple CRUD operations with direct Supabase access
- Backend APIs handle computation-heavy operations requiring processing

Models included:
- message.py: Models for AI message processing and streaming
- task.py: Models for long-running background tasks
- user.py: Minimal user model for authentication

All models are aligned with frontend types in /frontend/lib/types/ for consistency.
"""
