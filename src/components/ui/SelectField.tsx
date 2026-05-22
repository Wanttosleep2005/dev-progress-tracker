import { ChevronDown } from 'lucide-react';
import type { ReactNode, SelectHTMLAttributes } from 'react';

type Option = {
  label: string;
  value: string | number;
};

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  options: Option[];
  placeholder?: string;
  wrapperClassName?: string;
  selectClassName?: string;
  children?: ReactNode;
}

export default function SelectField({
  options,
  placeholder,
  wrapperClassName = '',
  selectClassName = '',
  children,
  ...props
}: SelectFieldProps) {
  return (
    <div className={`relative ${wrapperClassName}`.trim()}>
      <select
        {...props}
        className={`custom-select w-full appearance-none rounded-xl border border-white/[0.08] bg-[#0d1726]/90 px-3 py-2.5 pr-10 text-sm text-slate-100 outline-none transition focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/15 ${selectClassName}`.trim()}
      >
        {placeholder !== undefined && (
          <option value="">{placeholder}</option>
        )}
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
        {children}
      </select>
      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
      />
    </div>
  );
}
