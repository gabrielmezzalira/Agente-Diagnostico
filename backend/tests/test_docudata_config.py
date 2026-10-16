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


# --- Fix round 1: chave/URL com caracteres perigosos e hosts enganosos ---

_CHAVES_RUINS = [
    "a" + "\r\n" + "X-Evil: 1",
    "a" + " " + "b",
    "a" + "\t" + "b",
    "chav" + "é",
    "\x01\x02",
]


@pytest.mark.parametrize("chave", _CHAVES_RUINS)
def test_chave_com_caracteres_invalidos_desliga(monkeypatch, caplog, chave):
    monkeypatch.setenv("DOCUDATA_URL", "https://docudata.exemplo.com")
    monkeypatch.setenv("DOCUDATA_DISCOVERY_KEY", chave)
    with caplog.at_level("DEBUG"):
        assert load_docudata_config() is None
    assert chave not in caplog.text and "docudata.exemplo.com" not in caplog.text


@pytest.mark.parametrize("url", [
    "https://docudata.exemplo.com\n",  # \n final e removido pelo strip; precisa de \n interno
    "https://docudata.exemplo.com/a b",
    "https://docudata.exemplo.com/" + "\r\n" + "X: y",
    "https://docudata.exemplo.com/" + "\n" + "x",
])
def test_url_com_espaco_ou_controle_desliga(monkeypatch, caplog, url):
    segredo = "seg" + "redo-xyz"
    monkeypatch.setenv("DOCUDATA_URL", url)
    monkeypatch.setenv("DOCUDATA_DISCOVERY_KEY", segredo)
    with caplog.at_level("DEBUG"):
        r = load_docudata_config()
    if url.strip() == "https://docudata.exemplo.com":
        assert r is not None  # so whitespace nas pontas: aparado
    else:
        assert r is None
    assert segredo not in caplog.text and "docudata.exemplo.com" not in caplog.text


@pytest.mark.parametrize("url", [
    "http://localhost.evil.com",
    "http://127.0.0.1.evil.com",
    "http://localhost@evil.com",
])
def test_hosts_enganosos_desligam(monkeypatch, url):
    monkeypatch.setenv("DOCUDATA_URL", url)
    monkeypatch.setenv("DOCUDATA_DISCOVERY_KEY", "chave")
    assert load_docudata_config() is None


@pytest.mark.parametrize("url", ["http://127.0.0.1:8000", "http://localhost:8000"])
def test_http_loopback_com_porta_aceito(monkeypatch, url):
    monkeypatch.setenv("DOCUDATA_URL", url)
    monkeypatch.setenv("DOCUDATA_DISCOVERY_KEY", "chave")
    assert load_docudata_config().url == url


def test_https_com_barra_final_normalizada(monkeypatch):
    monkeypatch.setenv("DOCUDATA_URL", "https://docudata.exemplo.com/api/")
    monkeypatch.setenv("DOCUDATA_DISCOVERY_KEY", "chave")
    assert load_docudata_config().url == "https://docudata.exemplo.com/api"
