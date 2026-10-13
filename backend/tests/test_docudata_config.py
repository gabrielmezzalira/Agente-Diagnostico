# backend/tests/test_docudata_config.py
import pytest

from app.config import load_docudata_config


@pytest.fixture(autouse=True)
def _limpo(monkeypatch):
    monkeypatch.delenv("DOCUDATA_URL", raising=False)
    monkeypatch.delenv("DOCUDATA_DISCOVERY_KEY", raising=False)


def test_sem_variaveis_a_integracao_fica_desligada():
    assert load_docudata_config() is None


def test_so_url_ou_so_chave_tambem_desliga(monkeypatch):
    monkeypatch.setenv("DOCUDATA_URL", "https://docudata.exemplo.com")
    assert load_docudata_config() is None
    monkeypatch.delenv("DOCUDATA_URL")
    monkeypatch.setenv("DOCUDATA_DISCOVERY_KEY", "chave")
    assert load_docudata_config() is None


def test_https_e_aceito_e_a_barra_final_some(monkeypatch):
    monkeypatch.setenv("DOCUDATA_URL", "https://docudata.exemplo.com/")
    monkeypatch.setenv("DOCUDATA_DISCOVERY_KEY", "chave")
    cfg = load_docudata_config()
    assert cfg.url == "https://docudata.exemplo.com" and cfg.discovery_key == "chave"


def test_http_so_em_localhost(monkeypatch):
    monkeypatch.setenv("DOCUDATA_DISCOVERY_KEY", "chave")
    monkeypatch.setenv("DOCUDATA_URL", "http://localhost:8001")
    assert load_docudata_config() is not None
    monkeypatch.setenv("DOCUDATA_URL", "http://docudata.exemplo.com")
    assert load_docudata_config() is None  # a chave nunca viaja em texto puro


# --- Casos extras além do brief (mínimo seguro) ---

def test_branco_ou_so_espacos_desliga(monkeypatch):
    monkeypatch.setenv("DOCUDATA_URL", "   ")
    monkeypatch.setenv("DOCUDATA_DISCOVERY_KEY", "chave")
    assert load_docudata_config() is None
    monkeypatch.setenv("DOCUDATA_URL", "https://docudata.exemplo.com")
    monkeypatch.setenv("DOCUDATA_DISCOVERY_KEY", "  \t ")
    assert load_docudata_config() is None


def test_espacos_sao_aparados(monkeypatch):
    monkeypatch.setenv("DOCUDATA_URL", "  https://docudata.exemplo.com/  ")
    monkeypatch.setenv("DOCUDATA_DISCOVERY_KEY", "  chave  ")
    cfg = load_docudata_config()
    assert cfg.url == "https://docudata.exemplo.com" and cfg.discovery_key == "chave"


@pytest.mark.parametrize("url", [
    "https://user:senha@docudata.exemplo.com",
    "https://user@docudata.exemplo.com",
    "http://localhost@evil.com",
    "https://docudata.exemplo.com?x=1",
    "https://docudata.exemplo.com/#frag",
    "ftp://docudata.exemplo.com",
    "docudata.exemplo.com",
    "https://",
    "http://localhost:abc",
])
def test_urls_invalidas_ou_inseguras_desligam_sem_excecao(monkeypatch, url):
    monkeypatch.setenv("DOCUDATA_URL", url)
    monkeypatch.setenv("DOCUDATA_DISCOVERY_KEY", "chave")
    assert load_docudata_config() is None


def test_chave_nao_aparece_em_repr_str_nem_log(monkeypatch, caplog):
    segredo = "segredo-super-sensivel-123"
    monkeypatch.setenv("DOCUDATA_URL", "https://docudata.exemplo.com")
    monkeypatch.setenv("DOCUDATA_DISCOVERY_KEY", segredo)
    cfg = load_docudata_config()
    assert segredo not in repr(cfg) and segredo not in str(cfg)
    monkeypatch.setenv("DOCUDATA_URL", f"http://x.com/{segredo}")
    with caplog.at_level("DEBUG"):
        assert load_docudata_config() is None
    assert segredo not in caplog.text


def test_config_e_imutavel(monkeypatch):
    monkeypatch.setenv("DOCUDATA_URL", "https://docudata.exemplo.com")
    monkeypatch.setenv("DOCUDATA_DISCOVERY_KEY", "chave")
    cfg = load_docudata_config()
    with pytest.raises(Exception):
        cfg.url = "https://outro.com"
