import google.generativeai as genai
from config import settings
from typing import List, Dict
from utils.logger import logger


if settings.GEMINI_API_KEY:
    genai.configure(api_key=settings.GEMINI_API_KEY)
    GENAI_MODEL = genai.GenerativeModel(
        model_name='gemini-2.0-flash',
        generation_config={
            "temperature": 0.7,
            "top_p": 0.8,
            "top_k": 40,
            "max_output_tokens": 2048,
        },
        safety_settings=[
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
        ],
        system_instruction="You are a helpful AI assistant."
    )
else:
    logger.warning("Google API key not configured")
    GENAI_MODEL = None


def format_chat_history(history: List[Dict[str, str]]) -> List[Dict[str, str]]:
    """Format chat history for Google Generative AI"""
    formatted_history = []
    for message in history:
        role = message.get('role', 'user')
        content = message.get('content', '')
        if role == 'user':
            formatted_history.append({
                'role': 'user',
                'parts': [content]
            })
        elif role == 'assistant':
            formatted_history.append({
                'role': 'model',
                'parts': [content]
            })
    return formatted_history


def generate_text(prompt: str) -> str:
    import time
    # Static variables for rate limiting
    if not hasattr(generate_text, "_gemini_requests"):
        generate_text._gemini_requests = 0
        generate_text._gemini_window_start = time.time()
    # Rate limit: max 10 requests per minute
    if generate_text._gemini_requests >= 10:
        elapsed = time.time() - generate_text._gemini_window_start
        if elapsed < 60:
            sleep_time = 60 - elapsed
            logger.info(f"Gemini rate limit reached, sleeping for {sleep_time:.2f} seconds...")
            time.sleep(sleep_time)
        generate_text._gemini_requests = 0
        generate_text._gemini_window_start = time.time()
    if not settings.GEMINI_API_KEY or GENAI_MODEL is None:
        return "AI service is not configured. Please check your API key."
    if not prompt or len(prompt.strip()) == 0:
        return "Please provide a valid message."
    if len(prompt) > 8000:
        return "Message too long. Please limit your message to 8000 characters."
    try:
        response = GENAI_MODEL.generate_content(prompt)
        generate_text._gemini_requests += 1
        return response.text
    except Exception as e:
        logger.error(f"Error generating text: {e}")
        return "I apologize, but I'm experiencing technical difficulties. Please try again in a moment."
