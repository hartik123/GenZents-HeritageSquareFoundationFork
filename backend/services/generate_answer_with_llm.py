import os
from typing import List, Dict
from openai import OpenAI
from dotenv import load_dotenv
import re

# Load environment variables from .env file
load_dotenv()

client = OpenAI(
    api_key=os.getenv("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1"
)

def generate_answer_with_llm(query: str, retrieved_chunks: List[Dict]) -> str:
    """
    Tool: Uses Groq LLM to generate a natural language answer based on Drive content.
    """

    if not retrieved_chunks:
        return "❌ Sorry, I couldn't find anything relevant in your Drive to answer that."

    # Combine context
    context = "\n\n".join(
        f"[{i+1}] {chunk['text']}" for i, chunk in enumerate(retrieved_chunks)
    )

    # Prepare prompt messages
    messages = [
    {
        "role": "system",
        "content": (
            "You are a helpful AI assistant. "
            "Answer the user's question using the context provided from Google Drive documents. "
            "Always provide a clear, natural, and detailed response in full sentences. "
            "Do NOT include raw chunks, <think> tags, internal notes, or reasoning steps. "
            "If there is relevant information, summarize it and present it as a cohesive explanation. "
            "If nothing is found, simply say: 'I couldn't find anything in the documents about that.'"
        )
    },
    {"role": "user", "content": f"User Question: {query}\n\nRelevant Content:\n{context}"}
    ]

    # Generate response
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",  # Replace with your actual model name if different
        messages=messages,
        temperature=0.2
    )

    # Clean up any <think> tags in case model ignores instruction
    output = response.choices[0].message.content
    cleaned_output = re.sub(r"<think>.*?</think>", "", output, flags=re.DOTALL).strip()

    return cleaned_output