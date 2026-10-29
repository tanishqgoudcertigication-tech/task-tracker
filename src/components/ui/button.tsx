'use client';

import React, { forwardRef, ButtonHTMLAttributes } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'icon' | 'pill';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3B30] cursor-pointer disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 select-none';

    let variantStyles = '';
    if (variant === 'primary') {
      variantStyles =
        'bg-[#FF3B30] text-white hover:bg-[#E0342A] shadow-[0_0_15px_rgba(255,59,48,0.25)] hover:shadow-[0_0_20px_rgba(255,59,48,0.4)] border border-transparent';
    } else if (variant === 'secondary') {
      variantStyles =
        'bg-[#252A31] text-[#D9DEE5] border border-[#2F353D] hover:bg-[#2C323B] hover:border-[#3E4550] hover:text-white';
    } else if (variant === 'danger') {
      variantStyles =
        'bg-transparent text-[#FF3B30] border border-[#FF3B30] hover:bg-[#FF3B30]/15';
    } else if (variant === 'icon') {
      variantStyles =
        'w-10 h-10 min-w-10 min-h-10 rounded-full border border-[#2F353D] bg-[#252A31] text-[#D9DEE5] hover:border-[#FF3B30] hover:text-[#FF3B30] group';
    } else if (variant === 'pill') {
      variantStyles =
        'bg-[#252A31] text-[#9AA3AE] border border-[#2F353D] hover:text-[#D9DEE5] rounded-full';
    }

    let sizeStyles = '';
    if (variant !== 'icon') {
      if (size === 'sm') {
        sizeStyles = 'min-h-[34px] px-3.5 py-1 text-xs rounded-full gap-1.5';
      } else if (size === 'lg') {
        sizeStyles = 'min-h-[46px] px-6 py-2.5 text-sm rounded-full gap-2.5';
      } else {
        sizeStyles = 'min-h-[40px] px-4 py-2 text-xs rounded-full gap-2';
      }
    }

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${baseStyles} ${variantStyles} ${sizeStyles} ${className}`}
        {...props}
      >
        {loading ? (
          <>
            <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
            {variant !== 'icon' && <span>Loading...</span>}
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
