import { useEffect, useCallback } from 'react';

type HotkeyCallback = (event: KeyboardEvent) => void;

interface HotkeyOptions {
  enabled?: boolean;
  preventDefault?: boolean;
  description?: string;
  globalOverride?: boolean;
}

export function useHotkeys(
  keyCombo: string,
  callback: HotkeyCallback,
  options: HotkeyOptions = {}
) {
  const { enabled = true, preventDefault = true, description = '', globalOverride = false } = options;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      const keys = keyCombo.toLowerCase().split('+');
      const pressedKey = event.key?.toLowerCase() || '';
      const code = event.code?.toLowerCase() || '';

      const isAlt = keys.includes('alt') && event.altKey;
      const isCtrl = keys.includes('ctrl') && event.ctrlKey;
      const isShift = keys.includes('shift') && event.shiftKey;
      const isMeta = keys.includes('meta') && event.metaKey;

      const mainKey = keys.find((k) => !['alt', 'ctrl', 'shift', 'meta'].includes(k));
      
      const isMainKeyPressed = 
        pressedKey === mainKey || 
        code === mainKey || 
        (mainKey === 'escape' && pressedKey === 'escape') ||
        (mainKey === 'enter' && (pressedKey === 'enter' || code === 'numpadenter'));

      const modifiersMatch = 
        (keys.includes('alt') === event.altKey) &&
        (keys.includes('ctrl') === event.ctrlKey) &&
        (keys.includes('shift') === event.shiftKey) &&
        (keys.includes('meta') === event.metaKey);

      if (isMainKeyPressed && modifiersMatch) {
        const activeElement = document.activeElement;
        const isInput = 
          activeElement instanceof HTMLInputElement ||
          activeElement instanceof HTMLTextAreaElement ||
          activeElement instanceof HTMLSelectElement;

        // Critical Logic: Prevent triggers if in input, unless specific keys or globalOverride
        const allowedInInput = globalOverride || [
          'enter', 
          'numpadenter', 
          'arrowup', 
          'arrowdown', 
          'arrowleft', 
          'arrowright'
        ].includes(code) || [
          'enter',
          'arrowup', 
          'arrowdown', 
          'arrowleft', 
          'arrowright'
        ].includes(pressedKey);

        if (isInput && !allowedInInput) {
          return;
        }

        if (preventDefault) {
          event.preventDefault();
        }
        callback(event);
      }
    },
    [keyCombo, callback, enabled, preventDefault, globalOverride]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}
