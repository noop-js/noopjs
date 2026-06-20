import { signal, type Signal } from '@noopjs/signals';

export interface UseFieldOptions {
  validate?: (value: string) => string | null;
}

export interface UseFieldReturn {
  value: Signal<string>;
  error: Signal<string | null>;
  props: { value: string; onInput: (e: Event) => void };
  set: (v: string) => void;
  validate: () => string | null;
  reset: () => void;
}

export function useField(initialValue: string = '', options?: UseFieldOptions): UseFieldReturn {
  const value = signal(initialValue);
  const error = signal<string | null>(null);

  function validateField(): string | null {
    if (options?.validate) {
      const err = options.validate(value.get());
      error.set(err);
      return err;
    }
    return null;
  }

  return {
    value,
    error,
    props: {
      get value() { return value.get(); },
      onInput(e: Event) {
        const target = e.target as HTMLInputElement;
        value.set(target.value);
        if (error.get() !== null) validateField();
      },
    },
    set: (v: string) => { value.set(v); },
    validate: validateField,
    reset: () => { value.set(initialValue); error.set(null); },
  };
}

export interface FormProps {
  onSubmit: () => void;
  children: any;
  style?: string;
  className?: string;
}

export function Form(props: FormProps) {
  const form = document.createElement('form');
  if (props.className) form.className = props.className;
  if (props.style) form.setAttribute('style', typeof props.style === 'object' ? '' : props.style);
  if (typeof form.addEventListener === 'function') {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (props.onSubmit) props.onSubmit();
    });
  }
  const children = typeof props.children === 'function' ? props.children() : props.children;
  if (children != null) form.appendChild(children);
  return form;
}
