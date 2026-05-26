import httpx

RECALL_BASE = "https://{region}.recall.ai/api/v1"
DEFAULT_REGION = "us-west-2"


class RecallService:
    """Thin wrapper around the Recall.ai bot API."""

    def __init__(self, api_key: str, region: str = DEFAULT_REGION) -> None:
        self._api_key = api_key
        self._base = RECALL_BASE.format(region=region)

    def _headers(self) -> dict:
        return {
            "Authorization": self._api_key,
            "accept": "application/json",
            "content-type": "application/json",
        }

    def create_bot(self, meeting_url: str, webhook_url: str, session_id: str) -> str:
        """Send a bot to the meeting and return the bot_id."""
        body = {
            "meeting_url": meeting_url,
            "metadata": {"session_id": session_id},
            "recording_config": {
                "transcript": {
                    "provider": {
                        "recallai_streaming": {
                            "mode": "prioritize_low_latency",
                            "language_code": "pt",
                        }
                    },
                    "diarization": {
                        "use_separate_streams_when_available": True
                    },
                },
                "realtime_endpoints": [
                    {
                        "type": "webhook",
                        "url": webhook_url,
                        "events": ["transcript.data"],
                    }
                ],
            },
        }
        with httpx.Client() as client:
            resp = client.post(
                f"{self._base}/bot/",
                json=body,
                headers=self._headers(),
                timeout=15,
            )
            resp.raise_for_status()
            return resp.json()["id"]

    def stop_bot(self, bot_id: str) -> None:
        """Remove the bot from the meeting."""
        with httpx.Client() as client:
            resp = client.post(
                f"{self._base}/bot/{bot_id}/leave_call/",
                headers=self._headers(),
                timeout=10,
            )
            # 404 = bot already gone; treat as success
            if resp.status_code not in (200, 201, 204, 404):
                resp.raise_for_status()
