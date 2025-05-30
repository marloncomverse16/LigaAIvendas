interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Logo({ className = "", size = 'md' }: LogoProps) {
  const sizeClasses = {
    sm: 'h-8 px-3 py-1 text-lg',
    md: 'h-10 px-4 py-2 text-xl',
    lg: 'h-12 px-5 py-3 text-2xl'
  };

  return (
    <div className={`
      inline-flex items-center justify-center rounded-lg
      bg-gradient-to-r from-orange-500 to-orange-600
      text-white font-bold tracking-wide
      shadow-lg
      ${sizeClasses[size]}
      ${className}
    `}>
      <span className="text-white">Lig</span>
      <span className="text-yellow-300">AI</span>
      <div className="ml-2 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
        <span className="text-orange-600 text-sm font-bold">+</span>
      </div>
    </div>
  );
}