import { useState, type ComponentProps, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { FormField } from '@/components/shared/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError, authenticatedRequest, type User } from '@/lib/session';
import { sessionOptions } from '@/lib/session-query';

type Draft = {
  name: string;
  phone: string;
  street: string;
  city: string;
  postalCode: string;
};
type Errors = Partial<Record<keyof Draft | 'address', string>>;

const PHONE = /^\+?[0-9][0-9 ()-]{5,18}$/;

function draftOf(user: User): Draft {
  return {
    name: user.name,
    phone: user.phone ?? '',
    street: user.deliveryAddress?.street ?? '',
    city: user.deliveryAddress?.city ?? '',
    postalCode: user.deliveryAddress?.postalCode ?? '',
  };
}

function validate(draft: Draft): Errors {
  const errors: Errors = {};
  if (!draft.name.trim()) errors.name = 'Enter your name.';
  if (draft.phone.trim() && !PHONE.test(draft.phone.trim()))
    errors.phone = 'Enter a valid phone number.';
  const parts = [draft.street, draft.city, draft.postalCode].map((v) =>
    v.trim(),
  );
  // The address is optional, but all three parts go together.
  if (parts.some(Boolean)) {
    if (parts[0]!.length < 3) errors.street = 'Enter the street and number.';
    if (!parts[1]) errors.city = 'Enter the city.';
    if (parts[2]!.length < 3) errors.postalCode = 'Enter the postal code.';
  }
  return errors;
}

/**
 * Buyer name, phone and default delivery address. Shown read-only with an
 * Edit toggle; checkout pre-fills the saved address.
 */
export function PersonalDetails({ user }: { user: User }) {
  const client = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => draftOf(user));
  const [errors, setErrors] = useState<Errors>({});
  const [notice, setNotice] = useState('');
  const save = useMutation({
    mutationFn: (value: Draft) => {
      const street = value.street.trim();
      return authenticatedRequest<User>('account/details', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: value.name.trim(),
          phone: value.phone.trim() || null,
          deliveryAddress: street
            ? {
                street,
                city: value.city.trim(),
                postalCode: value.postalCode.trim(),
              }
            : null,
        }),
      });
    },
    onSuccess: (updated) => {
      client.setQueryData(sessionOptions.queryKey, updated);
      setEditing(false);
      setNotice('Details saved.');
    },
  });

  const set = (key: keyof Draft) => (value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
    if (save.isError) save.reset();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found = validate(draft);
    setErrors(found);
    const first = (
      ['name', 'phone', 'street', 'city', 'postalCode'] as const
    ).find((key) => found[key]);
    if (first) {
      document.getElementById(`details-${first}`)?.focus();
      return;
    }
    save.mutate(draft);
  };

  const address = user.deliveryAddress;
  const field = (
    key: keyof Draft,
    label: string,
    props: ComponentProps<typeof Input> = {},
  ) => (
    <FormField id={`details-${key}`} label={label} error={errors[key]}>
      <Input
        id={`details-${key}`}
        value={draft[key]}
        aria-invalid={Boolean(errors[key])}
        aria-describedby={errors[key] ? `details-${key}-error` : undefined}
        onChange={(event) => set(key)(event.target.value)}
        {...props}
      />
    </FormField>
  );

  return (
    <section className="mt-8" aria-labelledby="personal-details-title">
      <div className="flex items-center justify-between gap-3">
        <h2
          id="personal-details-title"
          className="font-sans text-lg font-semibold"
        >
          Personal details
        </h2>
        {!editing && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setDraft(draftOf(user));
              setErrors({});
              setNotice('');
              setEditing(true);
            }}
          >
            <Pencil aria-hidden="true" /> Edit
          </Button>
        )}
      </div>

      {!editing && (
        <>
          {notice && (
            <p role="status" className="mt-3 text-sm text-primary">
              {notice}
            </p>
          )}
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="mt-1 font-medium break-words">{user.name}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground">Phone</dt>
              <dd className="mt-1 break-words tabular-nums">
                {user.phone ?? (
                  <span className="text-muted-foreground">Not added</span>
                )}
              </dd>
            </div>
            <div className="min-w-0 sm:col-span-2">
              <dt className="text-muted-foreground">Delivery address</dt>
              <dd className="mt-1 break-words">
                {address ? (
                  `${address.street}, ${address.postalCode} ${address.city}`
                ) : (
                  <span className="text-muted-foreground">
                    Not added. A saved address fills in at checkout.
                  </span>
                )}
              </dd>
            </div>
          </dl>
        </>
      )}

      {editing && (
        <form className="mt-4 space-y-4" noValidate onSubmit={submit}>
          <div className="grid gap-4 md:grid-cols-2">
            {field('name', 'Name', { autoComplete: 'name', maxLength: 100 })}
            {field('phone', 'Phone', {
              type: 'tel',
              autoComplete: 'tel',
              inputMode: 'tel',
              maxLength: 20,
            })}
          </div>
          {field('street', 'Street address', {
            autoComplete: 'street-address',
            maxLength: 200,
          })}
          <div className="grid gap-4 md:grid-cols-2">
            {field('postalCode', 'Postal code', {
              autoComplete: 'postal-code',
              maxLength: 20,
            })}
            {field('city', 'City', {
              autoComplete: 'address-level2',
              maxLength: 100,
            })}
          </div>
          {save.isError && (
            <p role="alert" className="text-sm text-destructive">
              {save.error instanceof ApiError && save.error.status === 400
                ? save.error.message
                : 'Your details could not be saved. Try again.'}
            </p>
          )}
          {/* Reversed so Save sits on the right while staying first in tab order. */}
          <div className="flex flex-row-reverse flex-wrap justify-start gap-2">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={save.isPending}
              onClick={() => {
                setEditing(false);
                save.reset();
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
