import React, { useRef, useEffect, useCallback, useState } from 'react';

/**
 * Visible placeholder for scanned barcode (read-only). A hidden off-screen input
 * captures scanner input (keyboard wedge). Only the scanner fills the value;
 * manual typing does not appear in the visible field.
 */
export function BarcodeInput({ onScan, placeholder = 'Scan barcode here (scanner only)...', disabled, autoFocus = true }) {
  const inputRef = useRef(null);
  const bufferRef = useRef('');
  const timeoutRef = useRef(null);
  const [displayValue, setDisplayValue] = useState('');

  const flush = useCallback(() => {
    const value = bufferRef.current.trim();
    bufferRef.current = '';
    if (value) {
      setDisplayValue(value);
      if (onScan) onScan(value);
    }
  }, [onScan]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const onKeyDown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (bufferRef.current.trim()) flush();
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        bufferRef.current += e.key;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(flush, 150);
      }
    };
    el.addEventListener('keydown', onKeyDown);
    return () => {
      el.removeEventListener('keydown', onKeyDown);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [flush]);

  useEffect(() => {
    if (autoFocus && inputRef.current && !disabled) inputRef.current.focus();
  }, [autoFocus, disabled]);

  useEffect(() => {
    if (disabled) setDisplayValue('');
  }, [disabled]);

  return (
    <div className="mb-4">
      {/* Visible read-only display: shows last scanned value or placeholder */}
      <div
        role="textbox"
        aria-readonly="true"
        aria-label="Scanned barcode display"
        tabIndex={-1}
        onClick={() => inputRef.current?.focus()}
        className="w-full px-4 py-3 rounded-lg border-2 border-dashed border-school-blue-light/50 bg-school-surface text-school-blue font-mono min-h-[3rem] flex items-center"
      >
        {displayValue ? (
          <span className="text-lg font-semibold">{displayValue}</span>
        ) : (
          <span className="text-school-blue-light">{placeholder}</span>
        )}
      </div>
      {/* Hidden input off-screen: only this receives scanner input when focused */}
      <input
        ref={inputRef}
        type="text"
        disabled={disabled}
        autoComplete="off"
        aria-label="Barcode scan input"
        className="absolute opacity-0 pointer-events-none w-0 h-0"
        style={{ position: 'absolute', left: '-9999px' }}
      />
    </div>
  );
}
