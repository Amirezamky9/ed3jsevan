import React from 'react';
import { Input } from '../../components/ui/input';
import { en, fa } from '../../lib/utils';

/**
 * Price entry for the admin. Prices are BARE numbers in thousands (۱۷۵) —
 * never with a unit, never with ٬۰۰۰. The field ALWAYS shows Persian
 * digits and accepts Persian, Arabic-Indic, or Latin digits; the value
 * passed up is a plain number (or undefined when empty).
 *
 * The display deliberately does NOT switch to Latin digits on focus.
 * The earlier design did exactly that (Persian when blurred, Latin when
 * focused), and it was the bug: the focus-time value change ("۲۳۵" →
 * "235") invalidated any selection made against the pre-focus value, so
 * a select-all+type issued in the same tick as the focus (autofill,
 * Playwright fill, very fast keyboard) APPENDED instead of replacing
 * (235 + 236 = 235236, saved and published live). Two attempts to make
 * the conversion synchronous (native setter, with and without an input
 * event) both still raced — the value change itself is the problem, not
 * its timing. With one stable display value there is nothing to race:
 * focus changes nothing, select-all always selects what is shown, and
 * typing replaces it.
 */
export function PriceInput({
  id,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  id?: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const shown = value === undefined ? '' : fa(value);

  return (
    <Input
      id={id}
      type="text"
      inputMode="numeric"
      dir="ltr"
      className="text-start"
      value={shown}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => {
        const latin = en(e.target.value).replace(/[^0-9]/g, '');
        if (latin === '') {
          onChange(undefined);
          return;
        }
        const n = Number(latin);
        onChange(Number.isFinite(n) ? n : undefined);
      }}
    />
  );
}
