import { useState, useRef } from 'react';

/**
 * RippleButton - Button with ripple effect on click
 * Props:
 *   - children: React node
 *   - onClick: function
 *   - className: string (additional classes)
 *   - variant: 'primary' | 'secondary' | 'danger' (default: 'primary')
 *   - disabled: boolean
 *   - type: 'button' | 'submit' | 'reset'
 *   - title: string (tooltip)
 */
export function RippleButton({
  children,
  onClick,
  className = '',
  variant = 'primary',
  disabled = false,
  type = 'button',
  title,
  ...props
}) {
  const [ripples, setRipples] = useState([]);
  const buttonRef = useRef(null);

  const handleClick = (e) => {
    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const size = Math.max(rect.width, rect.height);
    const ripple = {
      id: Date.now(),
      x,
      y,
      size,
    };

    setRipples((prev) => [...prev, ripple]);

    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== ripple.id));
    }, 600);

    onClick?.(e);
  };

  const baseClasses = 'relative overflow-hidden transition-all-smooth';

  const variantClasses = {
    primary: 'bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-indigo-400',
    secondary: 'bg-slate-200 hover:bg-slate-300 text-slate-900 disabled:bg-slate-100',
    danger: 'bg-red-600 hover:bg-red-700 text-white disabled:bg-red-400',
  };

  return (
    <button
      ref={buttonRef}
      type={type}
      onClick={handleClick}
      disabled={disabled}
      title={title}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {/* Ripple elements */}
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className="absolute pointer-events-none bg-white opacity-75 rounded-full"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: ripple.size,
            height: ripple.size,
            transform: 'translate(-50%, -50%)',
            animation: `rippleExpand 0.6s ease-out`,
          }}
        />
      ))}

      {/* Button content */}
      <span className="relative z-10 flex items-center justify-center gap-2">
        {children}
      </span>

      <style>{`
        @keyframes rippleExpand {
          from {
            transform: translate(-50%, -50%) scale(0);
            opacity: 0.75;
          }
          to {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0;
          }
        }
      `}</style>
    </button>
  );
}

export default RippleButton;
