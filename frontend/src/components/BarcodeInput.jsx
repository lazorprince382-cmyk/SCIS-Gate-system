import React, { useRef, useEffect, useCallback, useState } from 'react';

/**
 * Keyboard-wedge barcode capture: a transparent input overlays the display so
 * USB/Bluetooth scanners can type into a real focused field. Commits on Enter
 * or after a short idle gap (scanners that omit Enter).
 */
export function BarcodeInput({
  onScan,
  placeholder = 'Scan barcode here (scanner only)...',
  disabled,
  autoFocus = true,
}) {
  const inputRef = useRef(null);
  const timeoutRef = useRef(null);
  const [displayValue, setDisplayValue] = useState('');

  const commitScan = useCallback(
    (raw) => {
      const value = String(raw ?? '')
        .replace(/[\r\n\t]/g, '')
        .trim();
      if (!value) return;
      setDisplayValue(value);
      if (onScan) onScan(value);
      if (inputRef.current) inputRef.current.value = '';
    },
    [onScan],
  );

  const queueCommit = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      if (inputRef.current?.value.trim()) {
        commitScan(inputRef.current.value);
      }
    }, 100);
  }, [commitScan]);

  useEffect(() => {
    if (!autoFocus || disabled) return undefined;
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [autoFocus, disabled]);

  useEffect(() => {
    if (!disabled) return;
    setDisplayValue('');
    if (inputRef.current) inputRef.current.value = '';
  }, [disabled]);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  return (
    <div className="mb-4 relative">
      <div
        aria-hidden
        className="w-full px-4 py-3 rounded-lg border-2 border-dashed border-school-blue-light/50 bg-school-surface text-school-blue font-mono min-h-[3rem] flex items-center pointer-events-none select-none"
      >
        {displayValue ? (
          <span className="text-lg font-semibold">{displayValue}</span>
        ) : (
          <span className="text-school-blue-light">{placeholder}</span>
        )}
      </div>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        disabled={disabled}
        autoComplete="off"
        autoFocus={autoFocus}
        aria-label="Barcode scan input"
        className="absolute inset-0 z-10 w-full min-h-[3rem] rounded-lg opacity-0 cursor-text bg-transparent border-0 outline-none focus:ring-2 focus:ring-school-blue"
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            commitScan(e.currentTarget.value);
          }
        }}
        onInput={queueCommit}
        onBlur={(e) => {
          if (e.currentTarget.value.trim()) {
            commitScan(e.currentTarget.value);
          }
        }}
      />
    </div>
  );
}
