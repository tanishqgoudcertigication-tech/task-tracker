'use client';

import React, { useEffect, ReactNode } from 'react';
import { Button } from './button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  eyebrow?: string;
  children: ReactNode;
  maxWidth?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  eyebrow,
  children,
  maxWidth = 'max-w-md',
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Modal dialog'}
      className="fixed inset-0 z-50 bg-[#0E1013]/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
    >
      <div
        className={`bg-[#1C1F24] border border-[#2F353D] rounded-[18px] shadow-[0_25px_60px_rgba(0,0,0,0.85)] animate-modal-in w-full ${maxWidth} p-6 sm:p-7 text-[#D9DEE5] relative my-auto`}
      >
        <div className="flex items-start justify-between pb-3.5 border-b border-[#2F353D] mb-5">
          <div>
            {eyebrow && (
              <span className="text-[10px] tracking-[0.25em] font-semibold text-[#9AA3AE] uppercase block mb-1">
                {eyebrow}
              </span>
            )}
            {title && (
              <h3 className="font-serif text-2xl font-light text-[#D9DEE5] tracking-tight">
                {title}
              </h3>
            )}
          </div>
          <Button
            variant="icon"
            onClick={onClose}
            aria-label="Close modal"
            className="shrink-0 -mr-1 -mt-1 !w-8 !h-8 !min-w-8 !min-h-8"
          >
            <svg className="w-4 h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>

        <div>{children}</div>
      </div>
    </div>
  );
}
