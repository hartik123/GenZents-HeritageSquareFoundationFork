from utils.logger import logger

async def create_prompt(user_supabase, user_id: str, chat_id: str, user_message: str) -> str:
    try:
        # Fetch user preferences
        pref_resp = user_supabase.table("profiles").select("communication_style, response_length, system_prompt, temperature").eq("id", user_id).execute()
        preferences = pref_resp.data[0] if pref_resp.data else {}
        # Fetch chat context summary
        chat_resp = user_supabase.table("chats").select("context_summary").eq("id", chat_id).execute()
        chat_context = chat_resp.data[0]["context_summary"] if chat_resp.data and chat_resp.data[0].get("context_summary") else ""
        # Fetch system instructions (from a table or static, here static for simplicity)
        system_instructions = "You are a helpful AI assistant."
        prompt = f"""
            USER_MESSAGE:\n{user_message}\n\n
            CHAT_CONTEXT:\n{chat_context}\n\n
            USER_PREFERENCES:\n{preferences}\n\n
            SYSTEM_INSTRUCTIONS:\n{system_instructions}\n\n
            REQUIRED_OUTPUT:\nAlso respond with an AI response to the user message."""
        return prompt
    except Exception as e:
        logger.error(f"Error creating prompt: {str(e)}")
        return ""
