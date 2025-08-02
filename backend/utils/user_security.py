"""
User Security and Constraints Service
Handles user permission checks, rate limiting, and security validations
"""

from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass
from utils.logger import logger
from storage.database import get_user_supabase_client
from models.user import User


@dataclass
class UserConstraints:
    """User constraints and limits"""
    max_storage: int
    max_tokens: int
    max_messages_per_day: int
    max_tasks_per_day: int
    max_api_calls_per_day: int

    messages_count: int
    tokens_used: int
    files_uploaded: int

    permissions: List[str]
    is_admin: bool
    status: str


@dataclass
class SecurityCheck:
    """Result of security validation"""
    allowed: bool
    reason: str
    remaining_quota: Optional[Dict[str, int]] = None
    suggestions: Optional[List[str]] = None


class UserSecurityService:
    """Service for user security checks and constraint validation"""

    def __init__(self, user_supabase_client):
        self.user_supabase = user_supabase_client

    async def get_user_constraints(self, user_id: str) -> UserConstraints:
        """Get user constraints and current usage stats"""
        try:
            # Get user profile with constraints and permissions
            profile_response = self.user_supabase.table("profiles").select(
                "max_storage, max_tokens, max_messages_per_day, max_tasks_per_day, "
                "max_api_calls_per_day, messages_count, tokens_used, files_uploaded, "
                "permissions, is_admin, status"
            ).eq("id", user_id).single().execute()

            if not profile_response.data:
                raise ValueError(f"User profile not found for user {user_id}")

            data = profile_response.data

            return UserConstraints(
                max_storage=data.get("max_storage", 1048576),  # 1GB default
                max_tokens=data.get("max_tokens", 50000),
                max_messages_per_day=data.get("max_messages_per_day", 100),
                max_tasks_per_day=data.get("max_tasks_per_day", 10),
                max_api_calls_per_day=data.get("max_api_calls_per_day", 1000),
                messages_count=data.get("messages_count", 0),
                tokens_used=data.get("tokens_used", 0),
                files_uploaded=data.get("files_uploaded", 0),
                permissions=data.get("permissions", []),
                is_admin=data.get("is_admin", False),
                status=data.get("status", "active")
            )

        except Exception as e:
            logger.error(f"Error fetching user constraints for {user_id}: {e}")
            # Return restrictive defaults on error
            return UserConstraints(
                max_storage=1048576,  # 1GB
                max_tokens=50000,
                max_messages_per_day=100,
                max_tasks_per_day=10,
                max_api_calls_per_day=1000,
                messages_count=0,
                tokens_used=0,
                files_uploaded=0,
                permissions=[],
                is_admin=False,
                status="active"
            )

    async def check_user_can_send_message(
            self, user_id: str, message_content: str) -> SecurityCheck:
        """Check if user can send a message based on constraints (task-creating command checks removed)"""
        try:
            constraints = await self.get_user_constraints(user_id)

            # Check if user is active
            if constraints.status != "active":
                return SecurityCheck(
                    allowed=False,
                    reason=f"Account status is {constraints.status}. Please contact support."
                )

            # Check daily message limit
            today_messages = await self._get_today_usage_count(user_id, "messages")
            if today_messages >= constraints.max_messages_per_day:
                return SecurityCheck(
                    allowed=False,
                    reason=f"Daily message limit reached ({constraints.max_messages_per_day}). Try again tomorrow.",
                    remaining_quota={"messages": 0}
                )

            # Estimate tokens (rough approximation: 1 token ≈ 4 characters)
            estimated_tokens = len(message_content) // 4

            # Check token limit
            if constraints.tokens_used + estimated_tokens > constraints.max_tokens:
                return SecurityCheck(
                    allowed=False,
                    reason=f"Token limit exceeded. Used: {constraints.tokens_used}, Limit: {constraints.max_tokens}",
                    remaining_quota={
                        "tokens": max(
                            0,
                            constraints.max_tokens -
                            constraints.tokens_used)}
                )

            # All checks passed
            return SecurityCheck(
                allowed=True,
                reason="Message allowed",
                remaining_quota={
                    "messages": constraints.max_messages_per_day - today_messages - 1,
                    "tokens": constraints.max_tokens - constraints.tokens_used - estimated_tokens
                }
            )

        except Exception as e:
            logger.error(
                f"Error checking message permissions for {user_id}: {e}")
            return SecurityCheck(
                allowed=False,
                reason="Security check failed. Please try again."
            )

    # Command permission checks removed as per user request

    async def validate_safe_prompt(self, prompt: str) -> SecurityCheck:
        """Validate that the prompt is safe and doesn't contain malicious content"""
        try:
            # Basic safety checks
            suspicious_patterns = [
                r"system\s*:",
                r"ignore\s+previous\s+instructions",
                r"act\s+as\s+if\s+you\s+are",
                r"pretend\s+to\s+be",
                r"jailbreak",
                r"developer\s+mode",
                r"<script",
                r"javascript:",
                r"eval\s*\(",
                r"exec\s*\(",
                r"__import__",
                r"subprocess",
                r"os\.system",
                r"shell\s*=\s*true"
            ]

            import re
            prompt_lower = prompt.lower()

            for pattern in suspicious_patterns:
                if re.search(pattern, prompt_lower):
                    logger.warning(f"Suspicious pattern detected: {pattern}")
                    return SecurityCheck(
                        allowed=False,
                        reason="Message contains potentially unsafe content",
                        suggestions=["Please rephrase your message"]
                    )

            # Check for excessive length (potential DoS)
            if len(prompt) > 50000:  # 50KB limit
                return SecurityCheck(
                    allowed=False,
                    reason="Message too long. Please keep messages under 50KB.",
                    suggestions=["Break your message into smaller parts"]
                )

            return SecurityCheck(allowed=True, reason="Prompt is safe")

        except Exception as e:
            logger.error(f"Error validating prompt safety: {e}")
            return SecurityCheck(
                allowed=False,
                reason="Safety validation failed. Please try again."
            )

    async def _get_today_usage_count(
            self, user_id: str, usage_type: str) -> int:
        """Get today's usage count for a specific type (messages, tasks, etc.)"""
        try:
            today = datetime.utcnow().date()

            if usage_type == "messages":
                # Count messages created today
                response = self.user_supabase.table("messages").select(
                    "id", count="exact"
                ).eq("user_id", user_id).gte(
                    "created_at", today.isoformat()
                ).lt(
                    "created_at", (today + timedelta(days=1)).isoformat()
                ).execute()

                return response.count or 0

            elif usage_type == "tasks":
                # Count tasks created today
                response = self.user_supabase.table("tasks").select(
                    "id", count="exact"
                ).eq("user_id", user_id).gte(
                    "created_at", today.isoformat()
                ).lt(
                    "created_at", (today + timedelta(days=1)).isoformat()
                ).execute()

                return response.count or 0

            return 0

        except Exception as e:
            logger.error(
                f"Error getting today's usage count for {user_id}: {e}")
            return 0

    async def update_user_usage(
            self, user_id: str, tokens_used: int = 0, messages_count: int = 0) -> bool:
        """Update user usage statistics"""
        try:
            updates = {}

            if tokens_used > 0:
                # Increment tokens_used
                response = self.user_supabase.table("profiles").select(
                    "tokens_used"
                ).eq("id", user_id).single().execute()

                current_tokens = response.data.get(
                    "tokens_used", 0) if response.data else 0
                updates["tokens_used"] = current_tokens + tokens_used

            if messages_count > 0:
                # Increment messages_count
                response = self.user_supabase.table("profiles").select(
                    "messages_count"
                ).eq("id", user_id).single().execute()

                current_messages = response.data.get(
                    "messages_count", 0) if response.data else 0
                updates["messages_count"] = current_messages + messages_count

            if updates:
                updates["last_active"] = datetime.utcnow().isoformat()

                self.user_supabase.table("profiles").update(updates).eq(
                    "id", user_id
                ).execute()

                logger.info(f"Updated usage for user {user_id}: {updates}")

            return True

        except Exception as e:
            logger.error(f"Error updating user usage for {user_id}: {e}")
            return False


def get_security_service(user_supabase_client) -> UserSecurityService:
    """Factory function to create security service instance"""
    return UserSecurityService(user_supabase_client)