export type ToastKind = "info" | "warn" | "success" | "error";

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  body?: string;
  duration?: number;
}

type Listener = (toast: Toast) => void;

const listeners = new Set<Listener>();
let nextId = 1;

export function showToast(input: Omit<Toast, "id">) {
  const toast: Toast = { id: nextId++, duration: 4000, ...input };
  listeners.forEach((l) => l(toast));
}

export function subscribeToToasts(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
