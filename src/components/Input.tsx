import * as React from 'react';
import { Search } from 'lucide-react';
import { clsx } from 'clsx';

type TextInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  mono?: boolean;
};

export function TextInput({ label, mono, className, ...rest }: TextInputProps) {
  return (
    <label className="flex flex-col gap-1 flex-1 min-w-[180px]">
      {label && <span className="text-[11px] font-semibold text-gray-700">{label}</span>}
      <input
        {...rest}
        className={clsx(
          'font-sans px-3.5 py-2.5 text-[13px] text-gray-900 bg-gray-50',
          'border border-gray-200 rounded-xl outline-none',
          'transition-[background,border-color,box-shadow] duration-150',
          'focus:bg-white focus:border-accent focus:shadow-[0_0_0_3px_rgba(37,99,235,.12)]',
          mono && 'tabular-nums font-bold tracking-tight',
          className,
        )}
        style={mono ? { fontVariantNumeric: 'tabular-nums' } : undefined}
      />
    </label>
  );
}

type SearchInputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function SearchInput({ className, ...rest }: SearchInputProps) {
  return (
    <div className="relative flex-1">
      <Search
        size={14}
        strokeWidth={1.75}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
      />
      <input
        {...rest}
        className={clsx(
          'w-full font-sans pl-9 pr-3.5 py-2.5 text-[13px] text-gray-900',
          'bg-gray-100 border border-transparent rounded-full outline-none box-border',
          'transition-[background,border-color,box-shadow] duration-150',
          'focus:bg-white focus:border-accent focus:shadow-[0_0_0_3px_rgba(37,99,235,.12)]',
          className,
        )}
      />
    </div>
  );
}
