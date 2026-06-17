import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * NumberField — empty by default. Never inserts a "0" automatically.
 * Parent stores numbers; an empty input maps to 0 internally but stays visually empty.
 */
export function NumberField({
  label, value, onChange, prefix, suffix, step = 1, min = 0, max, placeholder,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
  min?: number;
  max?: number;
  placeholder?: string;
}) {
  // Local string state so the input can be truly empty.
  const [raw, setRaw] = useState<string>(value > 0 ? String(value) : "");

  // Keep in sync if parent value changes externally (e.g. wizard reset).
  useEffect(() => {
    const current = Number(raw);
    if (value !== current && !(raw === "" && value === 0)) {
      setRaw(value > 0 ? String(value) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {prefix}
          </span>
        )}
        <Input
          type="number"
          inputMode="decimal"
          value={raw}
          step={step}
          min={min}
          max={max}
          placeholder={placeholder ?? (prefix ? "0" : "Enter value")}
          onChange={(e) => {
            const v = e.target.value;
            setRaw(v);
            if (v === "" || v === "-") {
              onChange(0);
            } else {
              const n = Number(v);
              if (Number.isFinite(n)) onChange(n);
            }
          }}
          onBlur={() => {
            // Normalize "-" or stray "." to empty
            if (raw === "-" || raw === ".") {
              setRaw("");
              onChange(0);
            }
          }}
          className={prefix ? "pl-7" : ""}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
