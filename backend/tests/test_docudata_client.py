import logging

import httpx
import pytest

from app.services.docudata_client import EnvioDefinitivoErro, EnvioFalhouErro, HttpDocudataGateway

PACOTE = {"docudata_project_id": "p1", "fonte_session_id": "sessao-0001", "tipo": "outra", "conteudo_estruturado": {}}


def _gateway(handler, esperas):
    async def dormir(segundos):
        esperas.append(segundos)
    return HttpDocudataGateway("https://docudata.exemplo.com", "chave-secreta", transporte=httpx.MockTransport(handler), dormir=dormir)


async def test_envia_com_a_chave_e_devolve_o_id():
    vistos = []

    def handler(req: httpx.Request):
        vistos.append(req)
        return httpx.Response(202, json={"id": "reuniao-1", "analise_status": "pendente", "duplicada": False})

    assert await _gateway(handler, []).enviar_reuniao(PACOTE) == "reuniao-1"
    assert str(vistos[0].url) == "https://docudata.exemplo.com/discovery/reunioes"
    assert vistos[0].headers["X-Discovery-Key"] == "chave-secreta"


async def test_reenvio_idempotente_200_tambem_vale():
    assert await _gateway(lambda r: httpx.Response(200, json={"id": "reuniao-1", "duplicada": True}), []).enviar_reuniao(PACOTE) == "reuniao-1"


async def test_tenta_de_novo_em_5xx_com_espera_crescente():
    respostas = iter([httpx.Response(503), httpx.Response(503), httpx.Response(202, json={"id": "ok"})])
    esperas: list[float] = []
    assert await _gateway(lambda r: next(respostas), esperas).enviar_reuniao(PACOTE) == "ok"
    assert esperas == [1.0, 2.0]


async def test_429_e_408_tambem_repetem():
    respostas = iter([httpx.Response(429), httpx.Response(408), httpx.Response(202, json={"id": "ok"})])
    assert await _gateway(lambda r: next(respostas), []).enviar_reuniao(PACOTE) == "ok"


async def test_recusa_4xx_nao_repete_e_nao_vaza_a_chave():
    chamadas = []

    def handler(req):
        chamadas.append(1)
        return httpx.Response(401, json={"detail": "chave inválida"})

    with pytest.raises(EnvioDefinitivoErro) as e:
        await _gateway(handler, []).enviar_reuniao(PACOTE)
    assert len(chamadas) == 1 and "chave-secreta" not in str(e.value) and "401" in str(e.value)


async def test_rede_fora_do_ar_esgota_as_tentativas():
    def handler(req):
        raise httpx.ConnectError("sem rede")

    esperas: list[float] = []
    with pytest.raises(EnvioFalhouErro) as e:
        await _gateway(handler, esperas).enviar_reuniao(PACOTE)
    assert esperas == [1.0, 2.0] and "chave-secreta" not in str(e.value)


@pytest.mark.parametrize("status", [400, 404, 409, 413, 422])
async def test_outros_4xx_nunca_repetem(status):
    chamadas = []

    def handler(req):
        chamadas.append(1)
        return httpx.Response(status)

    with pytest.raises(EnvioDefinitivoErro) as e:
        await _gateway(handler, []).enviar_reuniao(PACOTE)
    assert len(chamadas) == 1 and str(status) in str(e.value)


async def test_503_persistente_termina_em_envio_falhou():
    chamadas = []

    def handler(req):
        chamadas.append(1)
        return httpx.Response(503)

    with pytest.raises(EnvioFalhouErro):
        await _gateway(handler, []).enviar_reuniao(PACOTE)
    assert len(chamadas) == 3


async def test_redirecionamento_nao_e_seguido_e_e_definitivo():
    vistos = []

    def handler(req: httpx.Request):
        vistos.append(str(req.url))
        return httpx.Response(302, headers={"Location": "https://atacante.exemplo.com/x"})

    with pytest.raises(EnvioDefinitivoErro) as e:
        await _gateway(handler, []).enviar_reuniao(PACOTE)
    assert vistos == ["https://docudata.exemplo.com/discovery/reunioes"]
    assert "chave-secreta" not in str(e.value) and "atacante" not in str(e.value)


async def test_retry_after_e_respeitado_com_teto():
    respostas = iter([httpx.Response(429, headers={"Retry-After": "5"}),
                      httpx.Response(429, headers={"Retry-After": "9999"}),
                      httpx.Response(202, json={"id": "ok"})])
    esperas: list[float] = []
    assert await _gateway(lambda r: next(respostas), esperas).enviar_reuniao(PACOTE) == "ok"
    assert esperas == [5.0, 30.0]


@pytest.mark.parametrize("resposta", [
    httpx.Response(202, content=b"nao e json"),
    httpx.Response(202, json=["id"]),
    httpx.Response(202, json={"semid": 1}),
    httpx.Response(202, json={"id": 123}),
    httpx.Response(202, json={"id": ""}),
    httpx.Response(202, json={"id": "x" * 101}),
])
async def test_corpo_de_sucesso_inutilizavel_vira_envio_falhou(resposta):
    esperas: list[float] = []
    with pytest.raises(EnvioFalhouErro):
        await _gateway(lambda r: resposta, esperas).enviar_reuniao(PACOTE)
    assert esperas == [1.0, 2.0]


async def test_pacote_nao_serializavel_e_recusa_definitiva_sem_chamar_a_rede():
    from datetime import datetime
    chamadas = []

    def handler(req):
        chamadas.append(1)
        return httpx.Response(202, json={"id": "ok"})

    with pytest.raises(EnvioDefinitivoErro, match="pacote inválido"):
        await _gateway(handler, []).enviar_reuniao({"quando": datetime.now()})
    with pytest.raises(EnvioDefinitivoErro, match="pacote inválido"):
        await _gateway(handler, []).enviar_reuniao({"x": float("nan")})
    assert chamadas == []


async def test_chave_nao_vaza_em_repr_str_nem_logs(caplog):
    gateway = _gateway(lambda r: httpx.Response(503), [])
    assert "chave-secreta" not in repr(gateway) and "chave-secreta" not in str(gateway)
    with caplog.at_level(logging.DEBUG):
        with pytest.raises(EnvioFalhouErro) as e:
            await gateway.enviar_reuniao(PACOTE)
    assert "chave-secreta" not in caplog.text
    assert "sessao-0001" not in caplog.text
    assert "chave-secreta" not in repr(e.value)
