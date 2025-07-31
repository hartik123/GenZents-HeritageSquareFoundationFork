from utils.logger import logger

async def create_prompt(user_supabase, user_id: str, chat_id: str, user_message: str) -> str:
    try:
        # Fetch user preferences
        pref_resp = user_supabase.table("profiles").select("communication_style, response_length, system_prompt, temperature").eq("id", user_id).execute()
        preferences = pref_resp.data[0] if pref_resp.data else {}
        # Fetch chat context summary
        chat_resp = user_supabase.table("chats").select("context_summary").eq("id", chat_id).execute()
        chat_context = chat_resp.data[0]["context_summary"] if chat_resp.data and chat_resp.data[0].get("context_summary") else ""
        # Fetch last few messages (latest at top)
        msg_resp = user_supabase.table("messages").select("role, content, created_at").eq("chat_id", chat_id).eq("deleted", False).order("created_at", desc=True).limit(5).execute()
        last_messages = msg_resp.data if msg_resp.data else []
        last_messages_str = "\n".join([
            f"[{m['created_at']}] {m['role'].upper()}: {m['content']}" for m in last_messages
        ])
        # Fetch system instructions (from a table or static, here static for simplicity)
        system_instructions = "You are a helpful AI assistant."
        prompt = f"""
            USER_MESSAGE:\n{user_message}\n\n
            CHAT_CONTEXT:\n{chat_context}\n\n
            LAST_FEW_MESSAGES (sorted based on latest at top):\n{last_messages_str}\n\n
            USER_PREFERENCES:\n{preferences}\n\n
            SYSTEM_INSTRUCTIONS:\n{system_instructions}\n\n
            REQUIRED_OUTPUT:\nAlso respond with an AI response to the user message and also provide an updated context summary for the chat."""
        return prompt
    except Exception as e:
        logger.error(f"Error creating prompt: {str(e)}")
        return ""
