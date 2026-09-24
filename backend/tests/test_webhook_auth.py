# =============================================================================
# test_webhook_auth.py
#
# Fase 6 (Opt-In Webhook Auth) / Plano 06-01 — Task 1 (TAQ-03/D-01).
#
# Prova o gate opt-in por shared-secret em POST /webhook/extension:
# verify_extension_key() lê EXTENSION_SHARED_KEY do ambiente a cada chamada
# (nunca em nível de módulo) e compara com secrets.compare_digest. Testado
# como função direta (sem TestClient), no mesmo espírito de
# test_readiness_route.py — chama a dependência diretamente com monkeypatch
# de env var, sem subir a app inteira.
#
#   - SC1: EXTENSION_SHARED_KEY ausente -> no-op, qualquer header aceito
#   - SC2: EXTENSION_SHARED_KEY setada + header ausente/errado -> 401
#   - SC3: EXTENSION_SHARED_KEY setada + header correto -> aceita (None)
# =============================================================================

import pytest
from fastapi import HTTPException

from app.routers.webhook import verify_extension_key


def test_verify_extension_key_noop_when_unset(monkeypatch):
    """SC1: sem EXTENSION_SHARED_KEY no ambiente, a rota se comporta
    exatamente como hoje — nenhum header é exigido."""
    monkeypatch.delenv("EXTENSION_SHARED_KEY", raising=False)

    assert verify_extension_key(x_agente_key=None) is None
    assert verify_extension_key(x_agente_key="anything") is None


def test_verify_extension_key_rejects_missing_header_when_set(monkeypatch):
    """SC2: com a chave configurada, requisição sem o header é rejeitada
    com 401."""
    monkeypatch.setenv("EXTENSION_SHARED_KEY", "s3cr3t")

    with pytest.raises(HTTPException) as exc_info:
        verify_extension_key(x_agente_key=None)

    assert exc_info.value.status_code == 401


def test_verify_extension_key_rejects_wrong_value_when_set(monkeypatch):
    """SC2: com a chave configurada, requisição com valor errado é
    rejeitada com 401."""
    monkeypatch.setenv("EXTENSION_SHARED_KEY", "s3cr3t")

    with pytest.raises(HTTPException) as exc_info:
        verify_extension_key(x_agente_key="wrong")

    assert exc_info.value.status_code == 401


def test_verify_extension_key_accepts_correct_value_when_set(monkeypatch):
    """SC3: com a chave configurada e o header correto, a requisição é
    aceita (sem exceção)."""
    monkeypatch.setenv("EXTENSION_SHARED_KEY", "s3cr3t")

    assert verify_extension_key(x_agente_key="s3cr3t") is None
