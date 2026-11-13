import { useState } from 'react';
import { AddressSearch } from '@/components/shared/address-search';
import { useForm } from '@tanstack/react-form';
import { Pencil } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { components } from '@/lib/api-schema';
import { ApiError, authenticatedRequest, type User } from '@/lib/session';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/shared/form-field';

type ProducerApplicationResponse =
  components['schemas']['ProducerApplicationResponseDto'];
type ProducerApplicationDetails =
  components['schemas']['ProducerApplicationDetailsDto'];
type SubmitProducerApplication =
  components['schemas']['SubmitProducerApplicationDto'];
type ProducerStatus = ProducerApplicationResponse['status'];

const sessionKey = ['session'] as const;
const producerApplicationKey = (userId: string) =>
  ['producer-application', userId] as const;

const SUSPENDED_PRODUCER_BANNER_COPY =
  'Your account is suspended until the issue is resolved. You cannot create new auctions or register new products.';

function fetchProducerApplication(): Promise<ProducerApplicationResponse> {
  return authenticatedRequest<ProducerApplicationResponse>(
    'producer/application',
  );
}

function putProducerApplication(
  input: SubmitProducerApplication,
): Promise<ProducerApplicationResponse> {
  return authenticatedRequest<ProducerApplicationResponse>(
    'producer/application',
    {
      method: 'PUT',
      body: JSON.stringify(input),
    },
  );
}

function postResubmitProducerApplication(
  input: SubmitProducerApplication,
): Promise<ProducerApplicationResponse> {
  return authenticatedRequest<ProducerApplicationResponse>(
    'producer/application/resubmit',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

function formatSubmittedTimestamp(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(parsed);
}

function formatCoordinate(value: number): string {
  return value.toFixed(4);
}

type FieldErrors = {
  farmName?: string;
  city?: string;
  collectionAddress?: string;
  latitude?: string;
  longitude?: string;
  description?: string;
};

type ValidatedResult =
  | { ok: true; payload: SubmitProducerApplication }
  | {
      ok: false;
      errors: FieldErrors;
      firstFieldId: string;
    };

function validateApplicationInput(values: {
  farmName: string;
  city: string;
  collectionAddress: string;
  latitude: string;
  longitude: string;
  description: string;
}): ValidatedResult {
  const errors: FieldErrors = {};
  let firstFieldId = '';

  const recordError = (field: keyof FieldErrors, id: string, msg: string) => {
    errors[field] = msg;
    if (!firstFieldId) firstFieldId = id;
  };

  const farmName = values.farmName.trim();
  if (farmName.length < 1 || farmName.length > 120) {
    recordError(
      'farmName',
      'producer-farm-name',
      'Enter a farm or enterprise name between 1 and 120 characters.',
    );
  }

  const city = values.city.trim();
  if (city.length < 1 || city.length > 120) {
    recordError(
      'city',
      'producer-city',
      'Enter a city between 1 and 120 characters.',
    );
  }

  const collectionAddress = values.collectionAddress.trim();
  if (collectionAddress.length < 1 || collectionAddress.length > 240) {
    recordError(
      'collectionAddress',
      'producer-collection-address',
      'Enter a collection address between 1 and 240 characters.',
    );
  }

  const latTrimmed = values.latitude.trim();
  const latitude = latTrimmed === '' ? Number.NaN : Number(latTrimmed);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    recordError(
      'latitude',
      'producer-collection-address',
      'Pick your address from the search results to place it on the map.',
    );
  }

  const lngTrimmed = values.longitude.trim();
  const longitude = lngTrimmed === '' ? Number.NaN : Number(lngTrimmed);
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    recordError(
      'longitude',
      'producer-collection-address',
      'Pick your address from the search results to place it on the map.',
    );
  }

  const description = values.description.trim();
  if (description.length < 1 || description.length > 2000) {
    recordError(
      'description',
      'producer-description',
      'Enter a farm description between 1 and 2000 characters.',
    );
  }

  if (firstFieldId) {
    return { ok: false, errors, firstFieldId };
  }

  return {
    ok: true,
    payload: {
      farmName,
      description,
      city,
      collectionAddress,
      latitude,
      longitude,
    },
  };
}

function ApplicationSummaryCard({
  title,
  submittedAt,
  application,
  onEdit,
}: {
  title: string;
  submittedAt: string | null;
  application: ProducerApplicationDetails;
  onEdit?: () => void;
}) {
  return (
    <Card className="p-5 md:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-semibold">{title}</h3>
        {submittedAt && (
          <p className="text-xs text-muted-foreground">
            Submitted{' '}
            <time dateTime={submittedAt} className="tabular-nums">
              {formatSubmittedTimestamp(submittedAt)} UTC
            </time>
          </p>
        )}
        {onEdit && (
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            <Pencil aria-hidden="true" />
            Edit
          </Button>
        )}
      </div>
      <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-muted-foreground">Name</dt>
          <dd className="mt-1 font-medium break-words">
            {application.farmName}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-muted-foreground">City</dt>
          <dd className="mt-1 break-words">{application.city}</dd>
        </div>
        <div className="min-w-0 sm:col-span-2">
          <dt className="text-muted-foreground">Address</dt>
          <dd className="mt-1 break-words">{application.collectionAddress}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-muted-foreground">Coordinates</dt>
          <dd className="mt-1 tabular-nums">
            {formatCoordinate(application.latitude)},{' '}
            {formatCoordinate(application.longitude)}
          </dd>
        </div>
        <div className="min-w-0 sm:col-span-2">
          <dt className="text-muted-foreground">Description</dt>
          <dd className="mt-1 max-w-[70ch] leading-relaxed whitespace-pre-line break-words">
            {application.description}
          </dd>
        </div>
      </dl>
    </Card>
  );
}

function ProducerApplicationForm({
  userId,
  mode,
  initialApplication,
  conflictMessage,
  savedMessage,
  onClearSavedMessage,
  onConflictRefresh,
  onSaved,
  onCancel,
}: {
  userId: string;
  mode: 'submit' | 'update' | 'resubmit';
  initialApplication: ProducerApplicationDetails | null;
  conflictMessage: string;
  savedMessage: string;
  onClearSavedMessage: () => void;
  onConflictRefresh: () => Promise<void>;
  onSaved: (
    updated: ProducerApplicationResponse,
    notice: string,
  ) => Promise<void>;
  /** Shown as a Cancel button next to the submit button when given. */
  onCancel?: () => void;
}) {
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const mutation = useMutation({
    mutationFn: (input: SubmitProducerApplication) =>
      mode === 'resubmit'
        ? postResubmitProducerApplication(input)
        : putProducerApplication(input),
    onSuccess: async (updated) => {
      setFieldErrors({});
      const notice =
        mode === 'resubmit'
          ? 'Application resubmitted for administrator review.'
          : mode === 'update'
            ? 'Pending application details updated.'
            : 'Application submitted for administrator review.';
      await onSaved(updated, notice);
    },
    onError: async (error) => {
      onClearSavedMessage();
      if (error instanceof ApiError && error.status === 409) {
        await onConflictRefresh();
      }
    },
  });

  const form = useForm({
    defaultValues: {
      farmName: initialApplication?.farmName ?? '',
      city: initialApplication?.city ?? '',
      collectionAddress: initialApplication?.collectionAddress ?? '',
      latitude:
        initialApplication !== null ? String(initialApplication.latitude) : '',
      longitude:
        initialApplication !== null ? String(initialApplication.longitude) : '',
      description: initialApplication?.description ?? '',
    },
    onSubmit: async ({ value }) => {
      onClearSavedMessage();
      const validation = validateApplicationInput(value);
      if (!validation.ok) {
        setFieldErrors(validation.errors);
        document.getElementById(validation.firstFieldId)?.focus();
        return;
      }
      setFieldErrors({});
      try {
        await mutation.mutateAsync(validation.payload);
      } catch {
        // Error alert is rendered from mutation/conflict state while preserving entered field values.
      }
    },
  });

  const clearFieldError = (key: keyof FieldErrors) => {
    onClearSavedMessage();
    if (mutation.isError) mutation.reset();
    if (fieldErrors[key]) {
      setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  const addressError =
    fieldErrors.collectionAddress ??
    fieldErrors.latitude ??
    fieldErrors.longitude;

  const heading =
    mode === 'resubmit'
      ? 'Correct and resubmit application'
      : mode === 'update'
        ? 'Update pending application'
        : 'Complete your producer application';

  const helperCopy =
    mode === 'resubmit'
      ? 'Update your farm details to address the administrator feedback and send your application back for review.'
      : mode === 'update'
        ? 'You can refine your verification details while your application awaits administrator review.'
        : 'Provide your farm details and collection location so an administrator can verify your producer account.';

  const submitLabel =
    mode === 'resubmit'
      ? 'Resubmit application'
      : mode === 'update'
        ? 'Save application changes'
        : 'Submit application';

  const submittingLabel =
    mode === 'resubmit'
      ? 'Resubmitting…'
      : mode === 'update'
        ? 'Saving…'
        : 'Submitting…';

  return (
    <Card className="p-5 md:p-6" data-producer-id={userId}>
      <h3 className="text-lg font-semibold">{heading}</h3>
      <p className="mt-2 max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
        {helperCopy}
      </p>
      <form
        className="mt-5 space-y-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <form.Field name="farmName">
            {(field) => (
              <FormField
                id="producer-farm-name"
                label="Name"
                error={fieldErrors.farmName}
              >
                <Input
                  id="producer-farm-name"
                  type="text"
                  autoComplete="organization"
                  maxLength={120}
                  value={field.state.value}
                  aria-invalid={!!fieldErrors.farmName}
                  aria-describedby={
                    [fieldErrors.farmName ? 'producer-farm-name-error' : '']
                      .filter(Boolean)
                      .join(' ') || undefined
                  }
                  onBlur={field.handleBlur}
                  onChange={(event) => {
                    clearFieldError('farmName');
                    field.handleChange(event.target.value);
                  }}
                />
              </FormField>
            )}
          </form.Field>

          <form.Field name="city">
            {(field) => (
              <FormField
                id="producer-city"
                label="City"
                error={fieldErrors.city}
              >
                <Input
                  id="producer-city"
                  type="text"
                  autoComplete="address-level2"
                  maxLength={120}
                  value={field.state.value}
                  aria-invalid={!!fieldErrors.city}
                  aria-describedby={
                    [fieldErrors.city ? 'producer-city-error' : '']
                      .filter(Boolean)
                      .join(' ') || undefined
                  }
                  onBlur={field.handleBlur}
                  onChange={(event) => {
                    clearFieldError('city');
                    field.handleChange(event.target.value);
                  }}
                />
              </FormField>
            )}
          </form.Field>
        </div>

        <form.Subscribe
          selector={(state) =>
            [
              state.values.latitude,
              state.values.longitude,
              state.values.collectionAddress,
            ] as const
          }
        >
          {([latitude, longitude, address]) => (
            <FormField
              id="producer-collection-address"
              label="Address"
              error={addressError}
            >
              <AddressSearch
                id="producer-collection-address"
                describedBy={
                  addressError ? 'producer-collection-address-error' : undefined
                }
                value={address}
                onValueChange={(next) => {
                  clearFieldError('collectionAddress');
                  form.setFieldValue('collectionAddress', next);
                  // Edited text no longer matches the pin; pick again.
                  form.setFieldValue('latitude', '');
                  form.setFieldValue('longitude', '');
                }}
                latitude={
                  latitude.trim() === '' || !Number.isFinite(Number(latitude))
                    ? null
                    : Number(latitude)
                }
                longitude={
                  longitude.trim() === '' || !Number.isFinite(Number(longitude))
                    ? null
                    : Number(longitude)
                }
                onPick={(match) => {
                  form.setFieldValue('latitude', String(match.latitude));
                  form.setFieldValue('longitude', String(match.longitude));
                  if (!form.getFieldValue('city').trim() && match.city)
                    form.setFieldValue('city', match.city);
                  clearFieldError('latitude');
                  clearFieldError('longitude');
                }}
              />
            </FormField>
          )}
        </form.Subscribe>

        <form.Field name="description">
          {(field) => (
            <FormField
              id="producer-description"
              label="Description"
              error={fieldErrors.description}
            >
              <Textarea
                id="producer-description"
                rows={4}
                maxLength={2000}
                value={field.state.value}
                aria-invalid={!!fieldErrors.description}
                aria-describedby={
                  [fieldErrors.description ? 'producer-description-error' : '']
                    .filter(Boolean)
                    .join(' ') || undefined
                }
                onBlur={field.handleBlur}
                onChange={(event) => {
                  clearFieldError('description');
                  field.handleChange(event.target.value);
                }}
              />
            </FormField>
          )}
        </form.Field>

        {conflictMessage && (
          <div
            role="alert"
            className="rounded-lg border border-warning/40 bg-warning/20 p-4 text-sm text-foreground"
          >
            {conflictMessage}
          </div>
        )}

        {mutation.isError &&
          !(
            mutation.error instanceof ApiError && mutation.error.status === 409
          ) && (
            <p role="alert" className="text-sm text-destructive">
              {mutation.error instanceof ApiError &&
              mutation.error.status === 400
                ? 'Some application fields were rejected by the server. Check your details and coordinates and try again.'
                : mutation.error instanceof Error
                  ? mutation.error.message
                  : 'Could not save your producer application. Please try again.'}
            </p>
          )}

        {savedMessage && (
          <p role="status" className="text-sm font-medium text-primary">
            {savedMessage}
          </p>
        )}

        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(submitting) => (
            // Reversed so the submit button sits on the right while staying first in tab order.
            <div className="flex flex-row-reverse flex-wrap justify-start gap-2">
              <Button type="submit" disabled={submitting || mutation.isPending}>
                {submitting || mutation.isPending
                  ? submittingLabel
                  : submitLabel}
              </Button>
              {onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={submitting || mutation.isPending}
                  onClick={onCancel}
                >
                  Cancel
                </Button>
              )}
            </div>
          )}
        </form.Subscribe>
      </form>
    </Card>
  );
}

export function ProducerOnboarding({
  user,
  requestedSellingPath,
}: {
  user: User;
  requestedSellingPath?: string;
}) {
  const queryClient = useQueryClient();
  const appKey = producerApplicationKey(user.id);
  const [conflictNotice, setConflictNotice] = useState('');
  const [savedBanner, setSavedBanner] = useState('');
  const [editingPending, setEditingPending] = useState(false);

  const applicationQuery = useQuery({
    queryKey: appKey,
    queryFn: fetchProducerApplication,
    retry: false,
    staleTime: 0,
  });

  const refreshServerState = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: sessionKey }),
      queryClient.invalidateQueries({ queryKey: appKey }),
    ]);
  };

  const handleConflict = async () => {
    setSavedBanner('');
    setConflictNotice(
      'Your producer status changed on the server while you were editing. We refreshed your current status below.',
    );
    await refreshServerState();
  };

  const handleSaved = async (
    updated: ProducerApplicationResponse,
    notice: string,
  ) => {
    setConflictNotice('');
    setSavedBanner(notice);
    await queryClient.cancelQueries({ queryKey: appKey });
    queryClient.setQueryData<ProducerApplicationResponse>(appKey, updated);
    queryClient.setQueryData<User | null>(sessionKey, (existing) =>
      existing
        ? {
            ...existing,
            producerStatus: updated.status,
            producerRejectionReason: updated.rejectionReason,
          }
        : existing,
    );
    await refreshServerState();
  };

  const status: ProducerStatus =
    applicationQuery.data?.status ?? user.producerStatus ?? 'pending';
  const rejectionReason =
    applicationQuery.data !== undefined
      ? applicationQuery.data.rejectionReason
      : user.producerRejectionReason;
  const application = applicationQuery.data?.application ?? null;
  const submittedAt = applicationQuery.data?.submittedAt ?? null;

  const statusLabel =
    status === 'pending'
      ? 'Pending approval'
      : status === 'approved'
        ? 'Approved'
        : status === 'rejected'
          ? 'Application rejected'
          : 'Suspended';

  return (
    <section
      className="mt-8 space-y-6 empty:hidden"
      aria-label="Producer status"
    >
      {/* Approved and suspended accounts show their status as the header badge. */}
      {(status === 'pending' || status === 'rejected') && (
        <div>
          <h2 id="producer-onboarding-title" className="text-2xl font-semibold">
            Producer onboarding
          </h2>
          <p className="mt-1 max-w-[68ch] text-sm text-muted-foreground">
            Selling tools remain locked until an administrator approves your
            producer application.
          </p>
        </div>
      )}

      {requestedSellingPath && status !== 'approved' && (
        <div
          role="status"
          className="rounded-lg border border-border bg-secondary/60 p-4 text-sm text-foreground"
        >
          Product registration and auction creation routes (
          <code className="rounded bg-background px-1.5 py-0.5 text-xs">
            {requestedSellingPath}
          </code>
          ) are unavailable while your account status is{' '}
          <strong>{statusLabel.toLowerCase()}</strong>.
        </div>
      )}

      {conflictNotice && (status === 'approved' || status === 'suspended') && (
        <div
          role="alert"
          className="rounded-lg border border-warning/40 bg-warning/20 p-4 text-sm text-foreground"
        >
          {conflictNotice}
        </div>
      )}

      {applicationQuery.isError && applicationQuery.data && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-card p-4 text-sm"
        >
          <p className="text-destructive">
            Could not refresh your producer application. The information shown
            may be out of date.
          </p>
          <Button
            className="mt-3"
            size="sm"
            variant="outline"
            disabled={applicationQuery.isFetching}
            onClick={() => void applicationQuery.refetch()}
          >
            Retry
          </Button>
        </div>
      )}

      {status === 'suspended' && (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Card
            role="alert"
            className="border-destructive/40 bg-destructive/10 p-5 md:p-6"
          >
            <h3 className="text-lg font-semibold text-destructive">
              Account suspended
            </h3>
            <p className="mt-2 max-w-[65ch] text-sm font-medium leading-relaxed text-foreground">
              {SUSPENDED_PRODUCER_BANNER_COPY}
            </p>
            {applicationQuery.data?.suspensionReason && (
              <p className="mt-3 max-w-[65ch] text-sm leading-relaxed text-foreground">
                <span className="font-semibold">Reason:</span>{' '}
                {applicationQuery.data.suspensionReason}
              </p>
            )}
            <p className="mt-3 max-w-[65ch] text-sm leading-relaxed text-muted-foreground">
              Existing orders can still be fulfilled while your account is
              suspended, and active auctions finish normally.
            </p>
          </Card>

          {application ? (
            <ApplicationSummaryCard
              title="Verified farm details on file"
              submittedAt={submittedAt}
              application={application}
            />
          ) : (
            <Card className="p-5 md:p-6">
              <h3 className="text-lg font-semibold">
                Existing order fulfilment
              </h3>
              <p className="mt-2 max-w-[65ch] text-sm leading-relaxed text-muted-foreground">
                You retain access to handle and advance your existing buyer
                orders. New product registration and auction creation remain
                disabled until an administrator lifts the suspension.
              </p>
            </Card>
          )}
        </div>
      )}

      {status !== 'suspended' && applicationQuery.isPending && (
        <Card className="p-6 text-sm text-muted-foreground" role="status">
          Loading producer application…
        </Card>
      )}

      {status !== 'suspended' &&
        applicationQuery.isError &&
        !applicationQuery.data && (
          <Card className="p-6" role="alert">
            <p className="text-sm text-destructive">
              {applicationQuery.error instanceof Error
                ? applicationQuery.error.message
                : 'Could not load your producer application.'}
            </p>
            <Button
              className="mt-4"
              variant="outline"
              disabled={applicationQuery.isFetching}
              onClick={() => void applicationQuery.refetch()}
            >
              Try again
            </Button>
          </Card>
        )}

      {status === 'pending' && applicationQuery.data && (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="space-y-6">
            <Card className="p-5 md:p-6" role="status">
              <h3 className="text-lg font-semibold">Pending approval</h3>
              {application ? (
                <>
                  <p className="mt-2 max-w-[65ch] text-sm leading-relaxed text-muted-foreground">
                    Your producer application has been received and is awaiting
                    administrator review. Product registration, product drafts
                    and auction creation unlock once your account is approved.
                  </p>
                  {submittedAt && (
                    <p className="mt-3 text-sm text-foreground">
                      Last submitted:{' '}
                      <time
                        dateTime={submittedAt}
                        className="font-medium tabular-nums"
                      >
                        {formatSubmittedTimestamp(submittedAt)} UTC
                      </time>
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-2 max-w-[65ch] text-sm leading-relaxed text-muted-foreground">
                  Submit your farm details below for administrator verification.
                  You cannot prepare product drafts, publish products or create
                  auctions until your application is approved. Application
                  details are for producer verification, not product listings.
                </p>
              )}
            </Card>

            {application ? null : (
              <Card className="p-5 md:p-6">
                <h3 className="text-lg font-semibold">
                  Verification checklist
                </h3>
                <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-muted-foreground">
                  <li>
                    <strong className="font-medium text-foreground">
                      Farm identity:
                    </strong>{' '}
                    Public enterprise name and city shown on your producer page
                    and catalogue items.
                  </li>
                  <li>
                    <strong className="font-medium text-foreground">
                      Collection point:
                    </strong>{' '}
                    Street address and GPS coordinates so buyers can collect
                    orders directly from your farm.
                  </li>
                  <li>
                    <strong className="font-medium text-foreground">
                      Production practices:
                    </strong>{' '}
                    Overview of what you grow, seasonal methods and farm visit
                    arrangements.
                  </li>
                </ul>
              </Card>
            )}
          </div>

          {application && !editingPending ? (
            <div className="space-y-3">
              <ApplicationSummaryCard
                title="Submitted application details"
                submittedAt={null}
                application={application}
                onEdit={() => {
                  setSavedBanner('');
                  setEditingPending(true);
                }}
              />
              {savedBanner && (
                <p role="status" className="text-sm font-medium text-primary">
                  {savedBanner}
                </p>
              )}
            </div>
          ) : (
            <ProducerApplicationForm
              key={
                application
                  ? `pending-${submittedAt ?? 'saved'}`
                  : 'pending-initial'
              }
              userId={user.id}
              mode={application ? 'update' : 'submit'}
              initialApplication={application}
              conflictMessage={conflictNotice}
              savedMessage={savedBanner}
              onClearSavedMessage={() => setSavedBanner('')}
              onConflictRefresh={handleConflict}
              onSaved={async (updated, notice) => {
                await handleSaved(updated, notice);
                setEditingPending(false);
              }}
              onCancel={
                application ? () => setEditingPending(false) : undefined
              }
            />
          )}
        </div>
      )}

      {status === 'rejected' && applicationQuery.data && (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="space-y-6">
            <Card
              role="alert"
              className="border-destructive/40 bg-destructive/10 p-5 md:p-6"
            >
              <h3 className="text-lg font-semibold text-destructive">
                Application rejected
              </h3>
              <p className="mt-2 text-sm font-medium text-foreground">
                Administrator feedback:
              </p>
              <p className="mt-1 max-w-[65ch] text-sm leading-relaxed text-foreground">
                {rejectionReason?.trim()
                  ? rejectionReason
                  : 'No specific rejection reason was recorded. Review your farm and collection details below and resubmit for verification.'}
              </p>
              <p className="mt-3 max-w-[65ch] text-sm leading-relaxed text-muted-foreground">
                Selling tools remain unavailable while your application is
                rejected. Correct the details in the form and resubmit to return
                your application to pending review.
              </p>
            </Card>

            {application && (
              <ApplicationSummaryCard
                title="Previous application details"
                submittedAt={submittedAt}
                application={application}
              />
            )}
          </div>

          <ProducerApplicationForm
            key={`rejected-${submittedAt ?? 'initial'}`}
            userId={user.id}
            mode="resubmit"
            initialApplication={application}
            conflictMessage={conflictNotice}
            savedMessage={savedBanner}
            onClearSavedMessage={() => setSavedBanner('')}
            onConflictRefresh={handleConflict}
            onSaved={handleSaved}
          />
        </div>
      )}
    </section>
  );
}
