from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal
from math import ceil
from typing import Any

from pydantic import BaseModel


@dataclass(frozen=True)
class PricingInputs:
    start_date: date
    num_analysts: int
    hours_per_day: Decimal
    ticket_price: Decimal
    extra_calendar_days: int = 0


class PricingOutputs(BaseModel):
    total_horas: Decimal
    dias_uteis: Decimal
    dias_corridos: Decimal
    preco_total: Decimal
    duracao_meses: Decimal
    duracao_semanas: Decimal
    num_sprints: Decimal
    data_final: date


class PricingCalculator:
    @staticmethod
    def feature_dias(horas: Any, num_analysts: int, hours_per_day: Any) -> Decimal:
        daily_capacity = Decimal(str(num_analysts)) * Decimal(str(hours_per_day))
        if daily_capacity == 0:
            return Decimal(0)
        return Decimal(str(horas)) / daily_capacity

    @staticmethod
    def calculate(features: list[dict], inputs: PricingInputs) -> PricingOutputs:
        daily_capacity = Decimal(str(inputs.num_analysts)) * Decimal(str(inputs.hours_per_day))

        total_horas = sum(Decimal(str(f.get("horas", 0))) for f in features)

        if daily_capacity == 0:
            dias_uteis = Decimal(0)
        else:
            dias_uteis = total_horas / daily_capacity

        dias_corridos = dias_uteis * Decimal("1.4") + Decimal(str(inputs.extra_calendar_days))

        if dias_corridos == 0:
            preco_total = Decimal(0)
        else:
            preco_total = Decimal(str(inputs.ticket_price)) * (dias_corridos / Decimal("30"))

        duracao_meses = dias_corridos / Decimal("30")
        duracao_semanas = dias_corridos / Decimal("7")
        num_sprints = dias_uteis / Decimal("5") if dias_uteis > 0 else Decimal(0)
        data_final = inputs.start_date + timedelta(days=ceil(float(dias_corridos)))

        return PricingOutputs(
            total_horas=total_horas,
            dias_uteis=dias_uteis,
            dias_corridos=dias_corridos,
            preco_total=preco_total,
            duracao_meses=duracao_meses,
            duracao_semanas=duracao_semanas,
            num_sprints=num_sprints,
            data_final=data_final,
        )
