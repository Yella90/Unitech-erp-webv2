/**
 * LoadingSpinner - Animated spinner component
 * 
 * Props:
 *   - size: 'sm' | 'md' | 'lg' (default: 'md')
 *   - color: string (Tailwind class, default: 'text-indigo-600')
 */
export function LoadingSpinner({ size = 'md', color = 'text-indigo-600' }) {
  const sizeClasses = {
    sm: 'h-4 w-4 border-2',
    md: 'h-6 w-6 border-2',
    lg: 'h-10 w-10 border-3',
  };

  const colorStyles = {
    'text-indigo-600': '#4f46e5',
    'text-sky-600': '#0284c7',
    'text-emerald-600': '#059669',
    'text-rose-600': '#e11d48',
    'text-slate-600': '#475569',
  };
  const borderTopColor = colorStyles[color] || colorStyles['text-indigo-600'];

  return (
    <div
      className={`${sizeClasses[size]} rounded-full border-slate-200 animate-spin`}
      style={{ borderTopColor }}
    />
  );
}

/**
 * LoadingOverlay - Full screen loading overlay
 * 
 * Props:
 *   - isVisible: boolean
 *   - message: string
 */
export function LoadingOverlay({ isVisible, message = 'Chargement...' }) {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="animate-fadeInScale rounded-lg bg-white p-6 shadow-2xl">
        <div className="flex items-center gap-4">
          <LoadingSpinner size="lg" color="text-indigo-600" />
          <p className="text-sm font-medium text-slate-900">{message}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * SkeletonLoading - Placeholder for loading content
 * 
 * Props:
 *   - rows: number (default: 3)
 *   - className: string
 */
export function SkeletonLoading({ rows = 3, className = '' }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: rows }).map((_, idx) => (
        <div
          key={idx}
          className="h-12 rounded-md bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 animate-pulse"
        />
      ))}
    </div>
  );
}

/**
 * ProgressBar - Animated progress bar
 * 
 * Props:
 *   - value: number (0-100)
 *   - animated: boolean (default: true)
 */
export function ProgressBar({ value = 0, animated = true }) {
  return (
    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
      <div
        className={`h-full bg-indigo-600 transition-all-smooth ${
          animated ? 'animate-drawBars' : ''
        }`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

/**
 * CircleProgressBar - Circular progress indicator
 * 
 * Props:
 *   - value: number (0-100)
 *   - size: number (default: 60, in pixels)
 *   - label: string
 */
export function CircleProgressBar({ value = 0, size = 60, label }) {
  const circumference = 2 * Math.PI * (size / 2 - 4);
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={size / 2 - 4}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="3"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={size / 2 - 4}
            fill="none"
            stroke="#4f46e5"
            strokeWidth="3"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-semibold text-slate-900">{value}%</span>
        </div>
      </div>
      {label && <p className="text-xs text-slate-600">{label}</p>}
    </div>
  );
}

export default LoadingSpinner;
