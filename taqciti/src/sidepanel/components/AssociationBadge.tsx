/**
 * Selo de associação do histórico (UI-SPEC §6): diz, ao lado do `StatusBadge`,
 * o que aconteceu com o envio da reunião ao Agente.
 *
 * `state` é obrigatório e não tem padrão de propósito: quem não tem associação
 * (reuniões criadas com o envio desligado, ou antigas) simplesmente não
 * renderiza o selo — quem decide isso é o mapeamento da fiação (08-17), nunca
 * este componente. Assim ele não inventa um "Sem cliente" para o passado.
 *
 * Mesmo padrão de `StatusBadge`: um `switch` exaustivo que escolhe o tom do
 * `Badge`. Nada de cor nova.
 */
import { Badge } from '../../shared/ui/Badge';

export type AssociationBadgeState = 'no-client' | 'sending' | 'sent' | 'stopped';

export function AssociationBadge({ state }: { state: AssociationBadgeState }) {
  switch (state) {
    case 'no-client':
      return <Badge tone="warning">Sem cliente</Badge>;
    case 'sending':
      return (
        <Badge tone="primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-dot" />
          Enviando
        </Badge>
      );
    case 'sent':
      return <Badge tone="primary">Enviada</Badge>;
    case 'stopped':
      return <Badge tone="warning">Envio parou</Badge>;
  }
}
