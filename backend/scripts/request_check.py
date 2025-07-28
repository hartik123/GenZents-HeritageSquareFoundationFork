import requests

url = "https://openrouter.ai/api/v1/key"
headers = {
    "Authorization": "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"
}
response = requests.get(url, headers=headers)
print(response.json())
