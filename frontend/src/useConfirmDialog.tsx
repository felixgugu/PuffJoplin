import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import ConfirmDialog, { type ConfirmDialogOptions } from './ConfirmDialog';

interface ConfirmDialogController {
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
  dialog: ReactNode;
}

export function useConfirmDialog(): ConfirmDialogController {
  const [options, setOptions] = useState<ConfirmDialogOptions | null>(null);
  const resolverRef = useRef<((confirmed: boolean) => void) | null>(null);

  const confirm = useCallback((nextOptions: ConfirmDialogOptions) => {
    resolverRef.current?.(false);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setOptions(nextOptions);
    });
  }, []);

  const settle = useCallback((confirmed: boolean) => {
    setOptions(null);
    const resolve = resolverRef.current;
    resolverRef.current = null;
    resolve?.(confirmed);
  }, []);

  useEffect(() => () => {
    resolverRef.current?.(false);
    resolverRef.current = null;
  }, []);

  const dialog = options ? (
    <ConfirmDialog
      {...options}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  ) : null;

  return { confirm, dialog };
}
