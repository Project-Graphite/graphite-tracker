import { useId } from 'react';

export function Toggle({
  checked,
  description,
  disabled = false,
  label,
  onChange,
}: {
  checked: boolean;
  description: string;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  const labelId = useId();
  return (
    <div
      className={`flex items-start justify-between gap-4 rounded-xl border border-line bg-surface p-4 ${disabled ? 'opacity-55' : ''}`}
    >
      <span>
        <span className="block font-medium" id={labelId}>
          {label}
        </span>
        <span className="text-sm text-muted">{description}</span>
      </span>
      <button
        aria-checked={checked}
        aria-labelledby={labelId}
        className="toggle"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        role="switch"
        type="button"
      >
        <span className="toggle-knob" />
      </button>
    </div>
  );
}
