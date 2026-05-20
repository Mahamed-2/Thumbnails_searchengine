// =============================================================================
// src/components/ui/Modal.tsx
// =============================================================================

'use client';

import { clsx } from 'clsx';
import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: ReactNode;
  className?: string;
}

const sizeMap = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({ isOpen, onClose, title, description, size = 'md', children, className }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const firstFocusRef = useRef<HTMLButtonElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Focus trap — focus the close button when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => firstFocusRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      aria-describedby={description ? 'modal-desc' : undefined}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" aria-hidden="true" />

      {/* Panel */}
      <div
        className={clsx(
          'relative w-full glass rounded-2xl shadow-2xl border border-[var(--border-strong)] animate-scale-in overflow-hidden',
          sizeMap[size],
          className
        )}
      >
        {/* Header */}
        {(title || true) && (
          <div className="flex items-start justify-between p-6 border-b border-[var(--border)]">
            <div>
              {title && (
                <h2 id="modal-title" className="text-lg font-semibold text-[var(--text-primary)]">
                  {title}
                </h2>
              )}
              {description && (
                <p id="modal-desc" className="text-sm text-[var(--text-secondary)] mt-1">
                  {description}
                </p>
              )}
            </div>
            <button
              ref={firstFocusRef}
              onClick={onClose}
              aria-label="Close modal"
              className="btn btn-ghost p-2 -mr-2 -mt-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[75vh]">{children}</div>
      </div>
    </div>
  );
}
