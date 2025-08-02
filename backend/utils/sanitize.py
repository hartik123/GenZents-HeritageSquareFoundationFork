def extract_json_from_string(ai_result):
    """Extract and parse JSON from Gemini string response, handling backticks, 'json' prefix, and extra text."""
    import json
    if not isinstance(ai_result, str):
        return None
    s = ai_result.strip()
    if s.startswith('```'):
        s = s.lstrip('`').strip()
    if s.lower().startswith('json'):
        s = s[4:].strip()
    start = s.find('{')
    end = s.rfind('}')
    if start != -1 and end != -1:
        json_str = s[start:end+1]
        try:
            return json.loads(json_str)
        except Exception:
            return None
    try:
        return json.loads(s)
    except Exception:
        return None

def remove_null_chars(data):
    if isinstance(data, str):
        return data.replace('\u0000', '')
    if isinstance(data, list):
        # Always return a list, even if empty
        return [remove_null_chars(item) for item in data]
    if isinstance(data, dict):
        cleaned = {}
        for k, v in data.items():
            # For tags field, always keep as list
            if k == 'tags':
                if v is None:
                    cleaned[k] = []
                elif isinstance(v, list):
                    cleaned[k] = [remove_null_chars(item) for item in v]
                else:
                    cleaned[k] = [remove_null_chars(v)]
            else:
                cleaned[k] = remove_null_chars(v)
        return cleaned
    return data
