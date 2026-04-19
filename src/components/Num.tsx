type NumProps = {
  children: React.ReactNode;
  className?: string;
};

export function Num({ children, className = '' }: NumProps) {
  return (
    <span
      className={`font-sans tabular-nums tracking-tight ${className}`}
      style={{ fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum"' }}
    >
      {children}
    </span>
  );
}
