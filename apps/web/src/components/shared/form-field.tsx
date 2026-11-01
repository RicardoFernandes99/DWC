import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';

type FormFieldProps = {
  id: string;
  label: string;
  description?: string;
  error?: string;
  children: ReactNode;
};
export function FormField({
  id,
  label,
  description,
  error,
  children,
}: FormFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {description && (
        <p id={`${id}-description`} className="text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
