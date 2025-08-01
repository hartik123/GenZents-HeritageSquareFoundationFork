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
