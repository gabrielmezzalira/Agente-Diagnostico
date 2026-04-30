from anthropic import Anthropic
from .base import LLMClient, Message


class ClaudeClient(LLMClient):
    def __init__(self, api_key: str, model_name: str):
        self._client = Anthropic(api_key=api_key)
        self._model_name = model_name
        self._system_prompt = None

    def generate(self, messages: list[Message]) -> str:
        system_parts = [m.content for m in messages if m.role == "system"]
        chat_messages = [m for m in messages if m.role != "system"]

        system_instruction = "\n\n".join(system_parts) if system_parts else None

        formatted_messages = [
            {"role": m.role, "content": m.content} for m in chat_messages
        ]

        response = self._client.messages.create(
            model=self._model_name,
            max_tokens=2048,
            system=system_instruction,
            messages=formatted_messages,
        )

        return response.content[0].text
