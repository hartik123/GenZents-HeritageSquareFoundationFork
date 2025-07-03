"""
Context Manager Service for handling chat context, user preferences, and chat summaries.
This service manages the context that gets passed to the LLM for enhanced responses.
"""

from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
import json
from utils.logger import logger
from storage.database import get_user_supabase_client
from services.generative_ai import generate_text


class ContextManager:
    """Manages chat context, user preferences, and conversation summaries."""
    
    def __init__(self, user_supabase_client):
        self.user_supabase = user_supabase_client
    
    async def get_user_preferences(self, user_id: str) -> Dict[str, Any]:
        """Retrieve user preferences and custom instructions from the database."""
        try:
            # Get user settings
            settings_response = self.user_supabase.table("profiles").select(
                "custom_instructions, communication_style, response_length, expertise_level, "
                "default_model, temperature, max_tokens, system_prompt"
            ).eq("user_id", user_id).execute()
            
            if not settings_response.data:
                # Return default preferences if not found
                return {
                    "custom_instructions": "",
                    "communication_style": "balanced",
                    "response_length": "balanced", 
                    "expertise_level": "intermediate",
                    "default_model": "gpt-4",
                    "temperature": 0.7,
                    "max_tokens": 2048,
                    "system_prompt": ""
                }
            
            preferences = settings_response.data[0]
            logger.info(f"Retrieved user preferences for user {user_id}")
            return preferences
            
        except Exception as e:
            logger.error(f"Error retrieving user preferences for {user_id}: {str(e)}")
            # Return default preferences on error
            return {
                "custom_instructions": "",
                "communication_style": "balanced",
                "response_length": "balanced",
                "expertise_level": "intermediate",
                "default_model": "gpt-4",
                "temperature": 0.7,
                "max_tokens": 2048,
                "system_prompt": ""
            }
    
    async def get_recent_messages(self, chat_id: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Get the last N messages from the chat for context."""
        try:
            messages_response = self.user_supabase.table("messages").select(
                "role, content, created_at, metadata"
            ).eq("chat_id", chat_id).eq("deleted", False).order(
                "created_at", desc=True
            ).limit(limit).execute()
            
            if not messages_response.data:
                return []
            
            # Reverse to get chronological order (oldest first)
            messages = list(reversed(messages_response.data))
            logger.info(f"Retrieved {len(messages)} recent messages for chat {chat_id}")
            return messages
            
        except Exception as e:
            logger.error(f"Error retrieving recent messages for chat {chat_id}: {str(e)}")
            return []
    
    async def get_chat_context_summary(self, chat_id: str) -> str:
        """Get the current context summary for the chat."""
        try:
            chat_response = self.user_supabase.table("chats").select(
                "context_summary"
            ).eq("id", chat_id).execute()
            
            if not chat_response.data:
                return ""
            
            summary = chat_response.data[0].get("context_summary", "")
            logger.info(f"Retrieved context summary for chat {chat_id}")
            return summary
            
        except Exception as e:
            logger.error(f"Error retrieving context summary for chat {chat_id}: {str(e)}")
            return ""
    
    async def generate_enhanced_system_prompt(
        self, 
        user_id: str, 
        chat_id: str,
        base_system_prompt: str = ""
    ) -> str:
        """Generate an enhanced system prompt including user preferences and context."""
        try:
            # Get user preferences
            preferences = await self.get_user_preferences(user_id)
            
            # Get chat context summary
            context_summary = await self.get_chat_context_summary(chat_id)
            
            # Build enhanced system prompt
            enhanced_prompt_parts = []
            
            # Start with base system prompt if provided
            if base_system_prompt:
                enhanced_prompt_parts.append(base_system_prompt)
            
            # Add user communication style preferences
            style_instructions = self._get_style_instructions(preferences)
            if style_instructions:
                enhanced_prompt_parts.append(style_instructions)
            
            # Add custom instructions if provided
            if preferences.get("custom_instructions"):
                enhanced_prompt_parts.append(f"User's custom instructions: {preferences['custom_instructions']}")
            
            # Add context summary if available
            if context_summary:
                enhanced_prompt_parts.append(f"Conversation context: {context_summary}")
            
            enhanced_prompt = "\n\n".join(enhanced_prompt_parts)
            logger.info(f"Generated enhanced system prompt for user {user_id}, chat {chat_id}")
            return enhanced_prompt
            
        except Exception as e:
            logger.error(f"Error generating enhanced system prompt: {str(e)}")
            return base_system_prompt or "You are a helpful AI assistant."
    
    def _get_style_instructions(self, preferences: Dict[str, Any]) -> str:
        """Generate style instructions based on user preferences."""
        style_map = {
            "professional": "Maintain a professional, formal tone. Be precise and comprehensive.",
            "casual": "Use a casual, friendly tone. Be conversational and approachable.",
            "friendly": "Be warm, encouraging, and supportive. Use positive language.",
            "balanced": "Use a balanced tone that's professional yet approachable.",
            "technical": "Use precise technical language. Be detailed and accurate."
        }
        
        length_map = {
            "concise": "Keep responses brief and to the point.",
            "balanced": "Provide moderately detailed responses.",
            "detailed": "Provide comprehensive, detailed explanations.",
            "comprehensive": "Provide thorough, in-depth responses with examples."
        }
        
        level_map = {
            "beginner": "Explain concepts simply, avoiding jargon. Provide basic examples.",
            "intermediate": "Use moderate complexity. Explain key concepts clearly.",
            "advanced": "Use advanced terminology. Assume good background knowledge.",
            "expert": "Use expert-level language and concepts."
        }
        
        instructions = []
        
        comm_style = preferences.get("communication_style", "balanced")
        if comm_style in style_map:
            instructions.append(style_map[comm_style])
        
        response_length = preferences.get("response_length", "balanced")
        if response_length in length_map:
            instructions.append(length_map[response_length])
        
        expertise_level = preferences.get("expertise_level", "intermediate")
        if expertise_level in level_map:
            instructions.append(level_map[expertise_level])
        
        return " ".join(instructions)
    
    async def update_context_summary(
        self, 
        chat_id: str, 
        recent_messages: List[Dict[str, Any]], 
        new_ai_response: str,
        current_summary: str = ""
    ) -> str:
        """Generate and update the context summary for the chat."""
        try:
            # Format recent conversation for summary generation
            conversation_text = self._format_conversation_for_summary(recent_messages, new_ai_response)
            
            # Generate summary prompt
            summary_prompt = self._build_summary_prompt(conversation_text, current_summary)
            
            # Generate new summary using AI
            new_summary = generate_text(
                prompt=summary_prompt,
                history=[],
                system_prompt="You are an expert at creating concise, informative conversation summaries."
            )
            
            # Update the chat with new summary
            await self._save_context_summary(chat_id, new_summary)
            
            logger.info(f"Updated context summary for chat {chat_id}")
            return new_summary
            
        except Exception as e:
            logger.error(f"Error updating context summary for chat {chat_id}: {str(e)}")
            return current_summary
    
    def _format_conversation_for_summary(
        self, 
        messages: List[Dict[str, Any]], 
        new_response: str
    ) -> str:
        """Format conversation messages for summary generation."""
        formatted_lines = []
        
        for msg in messages:
            role = msg.get("role", "unknown")
            content = msg.get("content", "")
            formatted_lines.append(f"{role.upper()}: {content}")
        
        # Add the new AI response
        formatted_lines.append(f"ASSISTANT: {new_response}")
        
        return "\n".join(formatted_lines)
    
    def _build_summary_prompt(self, conversation_text: str, current_summary: str) -> str:
        """Build the prompt for generating conversation summary."""
        if current_summary:
            prompt = f"""
Current conversation summary: {current_summary}

Recent conversation:
{conversation_text}

Please update the summary to include the new information from the recent conversation. 
Keep it concise (2-3 sentences) but informative, focusing on key topics, decisions, and context that would be helpful for future responses.
"""
        else:
            prompt = f"""
Conversation:
{conversation_text}

Please create a concise summary (2-3 sentences) of this conversation, focusing on key topics, decisions, and context that would be helpful for future responses.
"""
        
        return prompt
    
    async def _save_context_summary(self, chat_id: str, summary: str) -> None:
        """Save the updated context summary to the database."""
        try:
            self.user_supabase.table("chats").update({
                "context_summary": summary,
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", chat_id).execute()
            
        except Exception as e:
            logger.error(f"Error saving context summary for chat {chat_id}: {str(e)}")
            raise
    
    async def prepare_llm_context(
        self, 
        user_id: str, 
        chat_id: str, 
        user_message: str,
        base_system_prompt: str = ""
    ) -> Tuple[str, List[Dict[str, Any]], Dict[str, Any]]:
        """
        Prepare comprehensive context for LLM including:
        - Enhanced system prompt with user preferences
        - Recent message history
        - User preferences for response generation
        
        Returns: (enhanced_system_prompt, message_history, user_preferences)
        """
        try:
            # Get all context data concurrently
            preferences = await self.get_user_preferences(user_id)
            recent_messages = await self.get_recent_messages(chat_id, limit=5)
            enhanced_prompt = await self.generate_enhanced_system_prompt(
                user_id, chat_id, base_system_prompt
            )
            
            # Add the current user message to history
            current_message = {
                "role": "user",
                "content": user_message,
                "created_at": datetime.utcnow().isoformat()
            }
            message_history = recent_messages + [current_message]
            
            logger.info(f"Prepared LLM context for user {user_id}, chat {chat_id}")
            
            return enhanced_prompt, message_history, preferences
            
        except Exception as e:
            logger.error(f"Error preparing LLM context: {str(e)}")
            # Return minimal context on error
            return (
                base_system_prompt or "You are a helpful AI assistant.",
                [{"role": "user", "content": user_message}],
                {}
            )


def get_context_manager(user_supabase_client) -> ContextManager:
    """Factory function to create a ContextManager instance."""
    return ContextManager(user_supabase_client)
