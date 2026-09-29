/**
 * Campo da chave de autenticação do Agente (IN-05, decisão D1): o valor salvo
 * nunca é mostrado nem colocado no DOM — o input fica vazio e um indicador
 * diz se já há chave. Vazio ao salvar mantém a chave; digitar troca; o botão
 * "Remover chave" (só quando há chave salva) apaga.
 */
import { Button } from '@/shared/ui/Button';
import { TextField } from '@/shared/ui/Field';

interface AgenteApiKeyFieldProps {
  value: string;
  hasApiKey: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
  onRemove: () => void;
}

export function AgenteApiKeyField({
  value,
  hasApiKey,
  disabled,
  onChange,
  onRemove,
}: AgenteApiKeyFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor="agente-api-key"
        className="text-caption font-semibold uppercase tracking-wide text-muted"
      >
        Chave de autenticação (opcional)
      </label>
      <TextField
        id="agente-api-key"
        type="password"
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={
          hasApiKey ? 'digite para trocar a chave salva' : 'deixe em branco para não usar'
        }
        disabled={disabled}
      />
      {hasApiKey ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-caption text-muted">
            Chave configurada — deixe em branco para mantê-la.
          </p>
          <Button variant="ghost" size="compact" onClick={onRemove} disabled={disabled}>
            Remover chave
          </Button>
        </div>
      ) : null}
    </div>
  );
}
