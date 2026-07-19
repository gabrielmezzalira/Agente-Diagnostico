export interface PricingInputs {
  startDate: string
  numAnalysts: number
  hoursPerDay: number
  ticketPrice: number
  extraCalendarDays: number
}

export interface PricingOutputs {
  totalHoras: number
  diasUteis: number
  diasCorridos: number
  precoTotal: number
  duracaoMeses: number
  duracaoSemanas: number
  numSprints: number
  dataFinal: string
}

export function featureDias(
  horas: number,
  numAnalysts: number,
  hoursPerDay: number
): number {
  const dailyCapacity = numAnalysts * hoursPerDay
  if (dailyCapacity === 0) return 0
  return horas / dailyCapacity
}

export function calculatePricing(
  features: Array<{ horas: number | string }>,
  inputs: PricingInputs
): PricingOutputs {
  const totalHoras = features.reduce((sum, f) => sum + Number(f.horas), 0)
  const dailyCapacity = inputs.numAnalysts * inputs.hoursPerDay
  const diasUteis = dailyCapacity === 0 ? 0 : totalHoras / dailyCapacity
  const diasCorridos = diasUteis * 1.4 + inputs.extraCalendarDays
  const precoTotal = inputs.ticketPrice * (diasCorridos / 30)
  const duracaoMeses = diasCorridos / 30
  const duracaoSemanas = diasCorridos / 7
  const numSprints = diasUteis / 5

  const startDateObj = new Date(inputs.startDate + 'T00:00:00')
  startDateObj.setDate(startDateObj.getDate() + Math.ceil(diasCorridos))
  const dataFinal = startDateObj.toISOString().slice(0, 10)

  return {
    totalHoras,
    diasUteis,
    diasCorridos,
    precoTotal,
    duracaoMeses,
    duracaoSemanas,
    numSprints,
    dataFinal,
  }
}
