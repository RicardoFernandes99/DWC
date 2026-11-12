import { useEffect, useRef, useState } from 'react';
import { AddressSearch } from '@/components/shared/address-search';
import { NativeSelect } from '@/components/ui/native-select';
import { SegmentedTabs } from '@/components/shared/segmented-tabs';
import { useForm, useStore } from '@tanstack/react-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useBlocker,
  useLocation,
  useNavigate,
  useParams,
} from '@tanstack/react-router';
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ImagePlus,
  Plus,
  Sprout,
} from 'lucide-react';
import type { components } from '@/lib/api-schema';
import {
  formatLabel as label,
  PRODUCT_CATEGORIES as categories,
  PRODUCT_SEASONS as seasons,
  PRODUCT_UNITS as units,
  PRODUCTION_METHODS as methods,
} from '@/lib/format';
import { ApiError, authenticatedRequest } from '@/lib/session';
import { producerMetricsKey } from '@/features/producer-dashboard/metrics';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/shared/form-field';
import { EmptyState } from '@/components/shared/empty-state';
import { PackagePlus, Pencil } from 'lucide-react';

type Product = components['schemas']['ProducerProductResponseDto'];
type ProductListResponse =
  components['schemas']['ProducerProductListResponseDto'];
type ProductInput = components['schemas']['CreateProducerProductDto'];
type UpdateInput = components['schemas']['UpdateProducerProductDto'];
type Profile = components['schemas']['ProducerProfileResponseDto'];
type ProfileInput = components['schemas']['UpdateProducerProfileDto'];
type Category = Product['category'];
type Method = Product['productionMethod'];
type Season = Product['seasons'][number];
type Unit = Product['unit'];

const productKey = ['producer-products'] as const;
const profileKey = ['producer-profile'] as const;

function fetchProducts(page: number, includeArchived = false) {
  return authenticatedRequest<ProductListResponse>(
    `producer/products?page=${page}&limit=50${includeArchived ? '&includeArchived=true' : ''}`,
  );
}

function fetchProfile() {
  return authenticatedRequest<Profile>('producer/profile');
}

function fetchProduct(id: string) {
  if (!/^[a-f\d]{24}$/i.test(id))
    return Promise.reject(
      new ApiError(400, 'This product identifier is invalid.'),
    );
  return authenticatedRequest<Product>(
    `producer/products/${encodeURIComponent(id)}`,
  );
}

function errorCopy(error: unknown, action: string) {
  if (error instanceof ApiError && error.status === 409)
    return 'These details changed on the server. Your text is still here. Reload the current details before saving again.';
  if (error instanceof ApiError && error.status === 413)
    return 'That image is larger than the 5 MB upload limit.';
  if (error instanceof ApiError && error.status === 400)
    return 'The server rejected one or more values. Review your entries and try again.';
  if (error instanceof ApiError && error.status === 403)
    return 'Your account is not currently permitted to manage these details.';
  return error instanceof Error
    ? error.message
    : `Could not ${action}. Please try again.`;
}

function EditorHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  return (
    <div className="mb-5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Back to products
      </button>
      <h1 id="producer-products-title" className="text-3xl md:text-4xl">
        {title}
      </h1>
    </div>
  );
}

const DISCARD_MESSAGE = 'Discard your unsaved changes?';

function ProductEditor({
  product,
  onSaved,
}: {
  product?: Product;
  onSaved: () => void;
}) {
  const [baseProduct, setBaseProduct] = useState(product);
  const [selectedFile, setSelectedFile] = useState<File>();
  const [fieldError, setFieldError] = useState('');
  const [stockError, setStockError] = useState('');
  const [thresholdError, setThresholdError] = useState('');
  const [reloadError, setReloadError] = useState('');
  const [imageUploadFailed, setImageUploadFailed] = useState(false);
  const [preview, setPreview] = useState<string>();
  // Set once the user has chosen to leave (or saved), so the guard stays out of the way.
  const leaving = useRef(false);
  // Release the object URL of a replaced or discarded photo preview.
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  const client = useQueryClient();
  const archiveFromEditor = useMutation({
    mutationFn: () =>
      authenticatedRequest<Product>(
        `producer/products/${baseProduct!.id}/archive`,
        {
          method: 'POST',
          body: JSON.stringify({ revision: baseProduct!.revision }),
        },
      ),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: productKey });
      void client.invalidateQueries({ queryKey: producerMetricsKey });
      leaving.current = true;
      onSaved();
    },
  });
  const save = useMutation({
    mutationFn: (input: ProductInput | UpdateInput) =>
      authenticatedRequest<Product>(
        baseProduct
          ? `producer/products/${baseProduct.id}`
          : 'producer/products',
        {
          method: baseProduct ? 'PATCH' : 'POST',
          body: JSON.stringify(
            baseProduct ? { ...input, revision: baseProduct.revision } : input,
          ),
        },
      ),
    onSuccess: async (saved) => {
      setBaseProduct(saved);
      setImageUploadFailed(false);
      if (selectedFile) {
        const body = new FormData();
        body.set('revision', String(saved.revision));
        body.set('file', selectedFile);
        try {
          const uploaded = await authenticatedRequest<Product>(
            `producer/products/${saved.id}/image`,
            {
              method: 'POST',
              body,
              signal: AbortSignal.timeout(30000),
            },
          );
          setBaseProduct(uploaded);
        } catch (error) {
          setImageUploadFailed(true);
          throw error;
        }
      }
      await client.invalidateQueries({ queryKey: productKey });
      void client.invalidateQueries({ queryKey: producerMetricsKey });
      leaving.current = true;
      onSaved();
    },
  });
  const form = useForm({
    defaultValues: {
      name: product?.name ?? '',
      description: product?.description ?? '',
      category: product?.category ?? ('vegetables' as Category),
      productionMethod: product?.productionMethod ?? ('organic' as Method),
      seasons: product?.seasons ?? (['year_round'] as Season[]),
      price: product ? (product.priceCents / 100).toFixed(2) : '',
      unit: product?.unit ?? ('unit' as Unit),
      stock: String(product?.availableStock ?? 0),
      threshold: String(product?.lowStockThreshold ?? 0),
      published: product?.published ?? true,
    },
    onSubmit: async ({ value }) => {
      const priceText = value.price.trim();
      const priceMatch = /^(\d+)(?:\.(\d{1,2}))?$/.exec(priceText);
      const priceCents = priceMatch
        ? Number(priceMatch[1]) * 100 +
          Number((priceMatch[2] ?? '').padEnd(2, '0'))
        : Number.NaN;
      const stock =
        value.stock.trim() === '' ? Number.NaN : Number(value.stock);
      const threshold =
        value.threshold.trim() === '' ? Number.NaN : Number(value.threshold);
      setStockError(
        Number.isInteger(stock) && stock >= 0
          ? ''
          : 'Enter a whole number of available units.',
      );
      setThresholdError(
        Number.isInteger(threshold) && threshold >= 0
          ? ''
          : 'Enter a whole number for the low-stock warning.',
      );
      if (
        !value.name.trim() ||
        !value.description.trim() ||
        !Number.isSafeInteger(priceCents) ||
        priceCents < 1 ||
        !Number.isInteger(stock) ||
        stock < 0 ||
        !Number.isInteger(threshold) ||
        threshold < 0 ||
        value.seasons.length === 0
      ) {
        setFieldError(
          'Enter a name, description, price in whole cents, and non-negative whole quantities.',
        );
        if (!Number.isInteger(stock) || stock < 0)
          document.getElementById('product-stock')?.focus();
        else if (!Number.isInteger(threshold) || threshold < 0)
          document.getElementById('product-threshold')?.focus();
        return;
      }
      if (
        selectedFile &&
        (selectedFile.size > 5_242_880 ||
          !['image/jpeg', 'image/png', 'image/webp'].includes(
            selectedFile.type,
          ))
      ) {
        setFieldError('Choose a JPEG, PNG, or WebP image up to 5 MB.');
        return;
      }
      setFieldError('');
      const payload: ProductInput = {
        name: value.name.trim(),
        description: value.description.trim(),
        category: value.category,
        productionMethod: value.productionMethod,
        seasons: value.seasons,
        priceCents,
        unit: value.unit,
        availableStock: stock,
        lowStockThreshold: threshold,
        published: value.published,
      };
      try {
        await save.mutateAsync(payload);
      } catch {
        /* The mutation alert keeps entered values visible. */
      }
    },
  });
  const reloadProduct = async () => {
    if (!baseProduct) return;
    setReloadError('');
    try {
      const fresh = await fetchProduct(baseProduct.id);
      setBaseProduct(fresh);
      client.setQueryData([...productKey, fresh.id], fresh);
      form.setFieldValue('category', fresh.category);
      form.setFieldValue('productionMethod', fresh.productionMethod);
      form.setFieldValue('seasons', fresh.seasons);
      form.setFieldValue('price', (fresh.priceCents / 100).toFixed(2));
      form.setFieldValue('unit', fresh.unit);
      form.setFieldValue('stock', String(fresh.availableStock));
      form.setFieldValue('threshold', String(fresh.lowStockThreshold));
      form.setFieldValue('published', fresh.published);
      save.reset();
    } catch {
      setReloadError(
        'Could not reload the current product. Your form text remains here.',
      );
    }
  };
  const unsaved =
    useStore(form.store, (state) => !state.isDefaultValue) ||
    Boolean(selectedFile);
  const dirty = unsaved && !save.isSuccess;
  // Header links and the browser's back button.
  useBlocker({
    shouldBlockFn: () => {
      if (!dirty || leaving.current) return false;
      return !window.confirm(DISCARD_MESSAGE);
    },
    enableBeforeUnload: () => dirty && !leaving.current,
  });
  const requestLeave = () => {
    if (dirty && !window.confirm(DISCARD_MESSAGE)) return;
    leaving.current = true;
    onSaved();
  };
  // Compact overlay pills on the product photo.
  const pill = 'h-8 text-xs';
  const photo = preview ?? baseProduct?.imageUrl ?? undefined;
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <EditorHeader
        title={baseProduct ? 'Edit product' : 'Add product'}
        onBack={requestLeave}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-5">
        {/* Photo, name, category and method: mirrors the public product page. */}
        <section className="relative min-w-0 overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary/70">
          <label
            htmlFor="product-image"
            title={photo ? 'Replace photo' : 'Add photo'}
            className="block aspect-[4/3] cursor-pointer transition-[filter] hover:brightness-110 md:aspect-[16/10] lg:aspect-auto lg:h-full lg:min-h-[30rem]"
          >
            {photo ? (
              <img src={photo} alt="" className="size-full object-cover" />
            ) : (
              <div className="grid size-full place-items-center text-primary-foreground/30">
                <Sprout aria-hidden="true" className="size-16 stroke-[1.2]" />
              </div>
            )}
          </label>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/25" />
          {/* Overlays let clicks on empty areas fall through to the photo label. */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start gap-2 p-3 *:pointer-events-auto md:p-4">
            <form.Field name="productionMethod">
              {(field) => (
                <NativeSelect
                  variant="pill"
                  aria-label="Production method"
                  className={pill}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value as Method)}
                >
                  {methods.map((item) => (
                    <option key={item} value={item}>
                      {label(item)}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </form.Field>
            <form.Field name="category">
              {(field) => (
                <NativeSelect
                  variant="pill"
                  aria-label="Category"
                  className={pill}
                  value={field.state.value}
                  onChange={(e) =>
                    field.handleChange(e.target.value as Category)
                  }
                >
                  {categories.map((item) => (
                    <option key={item} value={item}>
                      {label(item)}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </form.Field>
            <label
              htmlFor="product-image"
              className="ml-auto inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-white/90 px-3 text-xs font-medium text-foreground shadow-xs focus-within:ring-[3px] focus-within:ring-ring/50"
            >
              <ImagePlus aria-hidden="true" className="size-3.5" />
              {photo ? 'Replace photo' : 'Add photo'}
              <input
                id="product-image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  setSelectedFile(file);
                  setPreview(file ? URL.createObjectURL(file) : undefined);
                }}
              />
            </label>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 md:p-6">
            <p className="mb-1 text-xs text-white/80">
              JPEG, PNG or WebP, up to 5 MB
              {selectedFile ? ` · ${selectedFile.name}` : ''}
            </p>
            <form.Field name="name">
              {(field) => (
                <input
                  id="product-name"
                  aria-label="Product name"
                  required
                  maxLength={120}
                  placeholder="Product name"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="pointer-events-auto w-full border-b border-white/40 bg-transparent pb-1 font-serif text-3xl leading-tight text-white outline-none placeholder:text-white/50 focus:border-white md:text-5xl"
                />
              )}
            </form.Field>
          </div>
        </section>

        {/* Price, stock and publishing: mirrors the buy card. */}
        <aside className="flex flex-col overflow-hidden rounded-2xl border bg-card">
          <div className="px-5 pt-5">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Price
            </p>
            <div className="mt-1 flex items-center gap-2">
              <form.Field name="price">
                {(field) => (
                  <div className="relative min-w-0 flex-1">
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-2xl text-muted-foreground"
                    >
                      €
                    </span>
                    <Input
                      id="product-price"
                      aria-label="Price in euros"
                      type="number"
                      min="0.01"
                      step="0.01"
                      inputMode="decimal"
                      required
                      placeholder="0.00"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      className="h-14 pl-8 text-3xl font-semibold tabular-nums"
                    />
                  </div>
                )}
              </form.Field>
              <form.Field name="unit">
                {(field) => (
                  <NativeSelect
                    aria-label="Sold per"
                    wrapperClassName="w-28 shrink-0"
                    className="h-14"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value as Unit)}
                  >
                    {units.map((item) => (
                      <option key={item} value={item}>
                        / {label(item)}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </form.Field>
            </div>
          </div>

          <div className="space-y-4 px-5 pt-5">
            <fieldset>
              <legend className="mb-2 text-sm text-muted-foreground">
                Season
              </legend>
              <form.Field name="seasons">
                {(field) => (
                  <div className="flex flex-wrap gap-1.5">
                    {seasons.map((season) => {
                      const selected = field.state.value.includes(season);
                      return (
                        <button
                          key={season}
                          type="button"
                          aria-pressed={selected}
                          onClick={() =>
                            field.handleChange(
                              selected
                                ? field.state.value.filter(
                                    (item) => item !== season,
                                  )
                                : [...field.state.value, season],
                            )
                          }
                          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none ${selected ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:border-primary/40 hover:bg-secondary'}`}
                        >
                          {label(season)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </form.Field>
            </fieldset>
            <div className="grid grid-cols-2 gap-3">
              <form.Field name="stock">
                {(field) => (
                  <FormField
                    id="product-stock"
                    label="Available stock"
                    error={stockError}
                  >
                    <Input
                      id="product-stock"
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      required
                      aria-invalid={Boolean(stockError)}
                      aria-describedby={
                        stockError ? 'product-stock-error' : undefined
                      }
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  </FormField>
                )}
              </form.Field>
              <form.Field name="threshold">
                {(field) => (
                  <FormField
                    id="product-threshold"
                    label="Low-stock warning"
                    error={thresholdError}
                  >
                    <Input
                      id="product-threshold"
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      required
                      aria-invalid={Boolean(thresholdError)}
                      aria-describedby={
                        thresholdError ? 'product-threshold-error' : undefined
                      }
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  </FormField>
                )}
              </form.Field>
            </div>
            <form.Field name="published">
              {(field) => (
                <button
                  type="button"
                  role="switch"
                  aria-checked={field.state.value}
                  onClick={() => field.handleChange(!field.state.value)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left text-sm focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <span>
                    <span className="block font-medium">
                      {field.state.value ? 'Published' : 'Unpublished'}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {field.state.value
                        ? 'Visible in the catalogue'
                        : 'Hidden from buyers'}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${field.state.value ? 'bg-primary' : 'bg-muted-foreground/40'}`}
                  >
                    <span
                      className={`absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-[left] ${field.state.value ? 'left-[18px]' : 'left-0.5'}`}
                    />
                  </span>
                </button>
              )}
            </form.Field>
          </div>

          <div className="mt-auto space-y-3 p-5">
            {fieldError && (
              <p role="alert" className="text-sm text-destructive">
                {fieldError}
              </p>
            )}
            {save.isError && (
              <div
                role="alert"
                className="space-y-2 rounded-lg border border-destructive/30 p-3 text-sm"
              >
                <p>
                  {imageUploadFailed && baseProduct
                    ? 'Product details were saved, but the image upload was refused. Reload the current product, then retry the image upload.'
                    : errorCopy(save.error, 'save the product')}
                </p>
                {save.error instanceof ApiError &&
                  save.error.status === 409 &&
                  baseProduct && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setReloadError('');
                        void reloadProduct();
                      }}
                    >
                      Reload current product
                    </Button>
                  )}
                {reloadError && (
                  <p role="alert" className="text-destructive">
                    {reloadError}
                  </p>
                )}
              </div>
            )}
            {archiveFromEditor.isError && (
              <p role="alert" className="text-sm text-destructive">
                {errorCopy(archiveFromEditor.error, 'archive the product')}
              </p>
            )}
            {save.isPending && (
              <div
                role="status"
                className="space-y-2 text-sm text-muted-foreground"
              >
                <p>Saving product and uploading image…</p>
                <progress
                  aria-label="Saving product and uploading image"
                  className="h-1.5 w-full accent-primary"
                />
              </div>
            )}
            <div className="flex gap-2">
              <Button
                type="submit"
                size="lg"
                className="h-12 flex-1 text-base"
                disabled={save.isPending}
              >
                {save.isPending
                  ? 'Saving…'
                  : baseProduct
                    ? 'Save changes'
                    : 'Create product'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-12"
                onClick={requestLeave}
              >
                Cancel
              </Button>
            </div>
            {baseProduct && !baseProduct.archivedAt && (
              <button
                type="button"
                disabled={archiveFromEditor.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      `Archive “${baseProduct.name}”? It will be unpublished. You can restore it from Archived.`,
                    )
                  )
                    archiveFromEditor.mutate();
                }}
                className="mx-auto flex items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <Archive aria-hidden="true" className="size-4" />
                {archiveFromEditor.isPending ? 'Archiving…' : 'Archive product'}
              </button>
            )}
          </div>
        </aside>

        <section className="min-w-0 rounded-xl border bg-card p-5 md:p-6 lg:col-span-2">
          <form.Field name="description">
            {(field) => (
              <>
                <label
                  htmlFor="product-description"
                  className="font-sans text-xs font-semibold tracking-wider text-muted-foreground uppercase"
                >
                  About this product
                </label>
                <Textarea
                  id="product-description"
                  required
                  rows={4}
                  maxLength={2000}
                  placeholder="Describe the product: how it is grown or made, what it tastes like, how to use it."
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="mt-2"
                />
              </>
            )}
          </form.Field>
        </section>
      </div>
    </form>
  );
}

function ProductImage({ product }: { product: Product }) {
  const [imageUrl, setImageUrl] = useState(product.imageUrl ?? '');
  const [retried, setRetried] = useState(false);
  return imageUrl ? (
    <img
      src={imageUrl}
      alt=""
      className="aspect-[4/3] w-full object-cover"
      onError={() => {
        if (retried || !product.hasImage) {
          setImageUrl('');
          return;
        }
        setRetried(true);
        void authenticatedRequest<{ url?: string }>(
          `producer/products/${product.id}/image`,
        )
          .then((value) => setImageUrl(value.url ?? ''))
          .catch(() => setImageUrl(''));
      }}
    />
  ) : (
    <div className="grid aspect-[4/3] place-items-center bg-secondary text-muted-foreground">
      <Sprout aria-hidden="true" className="size-10" />
      <span className="sr-only">No image uploaded or preview unavailable</span>
    </div>
  );
}

function ProductList({ onEdit }: { onEdit: (product: Product) => void }) {
  const [page, setPage] = useState(1);
  const [view, setView] = useState<'active' | 'archived'>('active');
  const client = useQueryClient();
  const query = useQuery({
    queryKey: [...productKey, view, page],
    queryFn: () => fetchProducts(page, view === 'archived'),
    retry: false,
  });
  const restore = useMutation({
    mutationFn: (product: Product) =>
      authenticatedRequest<Product>(`producer/products/${product.id}/restore`, {
        method: 'POST',
        body: JSON.stringify({ revision: product.revision }),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: producerMetricsKey });
      return client.invalidateQueries({ queryKey: productKey });
    },
  });
  const archive = useMutation({
    mutationFn: (product: Product) =>
      authenticatedRequest<Product>(`producer/products/${product.id}/archive`, {
        method: 'POST',
        body: JSON.stringify({ revision: product.revision }),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: producerMetricsKey });
      return client.invalidateQueries({ queryKey: productKey });
    },
  });
  if (query.isPending)
    return (
      <Card className="p-6 text-sm text-muted-foreground" role="status">
        Loading your products…
      </Card>
    );
  if (query.isError && !query.data)
    return (
      <Card className="p-6">
        <p role="alert" className="text-sm text-destructive">
          {errorCopy(query.error, 'load products')}
        </p>
        <Button
          className="mt-4"
          variant="outline"
          onClick={() => void query.refetch()}
        >
          Try again
        </Button>
      </Card>
    );
  const items =
    view === 'archived'
      ? query.data.items.filter((product) => product.archivedAt)
      : query.data.items;
  return (
    <section aria-labelledby="products-heading">
      {query.isError && query.data && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          Product refresh failed. The saved list may be out of date.
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedTabs
          label="Product status"
          value={view}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'archived', label: 'Archived' },
          ]}
          onChange={(value) => {
            setView(value);
            setPage(1);
          }}
        />
        <p id="products-heading" className="text-sm text-muted-foreground">
          {items.length} {view === 'active' ? 'active' : 'archived'}{' '}
          {items.length === 1 ? 'listing' : 'listings'}
        </p>
      </div>
      {archive.isError && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {errorCopy(archive.error, 'archive the product')}
        </p>
      )}
      {restore.isError && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {errorCopy(restore.error, 'restore the product')}
        </p>
      )}
      {items.length === 0 && view === 'archived' ? (
        <EmptyState
          className="mt-5"
          headingLevel="h3"
          icon={<Archive />}
          title="No archived products"
          description="Products you archive appear here, ready to restore."
        />
      ) : items.length === 0 ? (
        <EmptyState
          className="mt-5"
          headingLevel="h3"
          icon={<PackagePlus />}
          title="Your first product starts here"
          description="Add a product with its price, unit, stock, season and a clear description. You can attach an image while creating it."
        />
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4">
          {items.map((product) => {
            const archived = Boolean(product.archivedAt);
            const quick =
              'absolute top-2 right-2 z-10 grid size-8 place-items-center rounded-full bg-white/90 text-foreground shadow-sm transition-colors hover:bg-white focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50';
            return (
              <Card
                key={product.id}
                className={`group relative min-w-0 overflow-hidden transition-[border-color,box-shadow] ${archived ? 'opacity-80' : 'hover:border-primary/40 hover:shadow-md'}`}
              >
                <div className="relative">
                  <ProductImage
                    key={`${product.id}-${product.revision}-${product.imageUrl ?? ''}`}
                    product={product}
                  />
                  {archived ? (
                    <button
                      type="button"
                      aria-label={`Restore ${product.name}`}
                      title="Restore"
                      disabled={restore.isPending}
                      onClick={() => restore.mutate(product)}
                      className={quick}
                    >
                      <ArchiveRestore aria-hidden="true" className="size-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      aria-label={`Archive ${product.name}`}
                      title="Archive"
                      disabled={archive.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Archive “${product.name}”? It will be unpublished. You can restore it from Archived.`,
                          )
                        )
                          archive.mutate(product);
                      }}
                      className={`${quick} hover:text-destructive`}
                    >
                      <Archive aria-hidden="true" className="size-4" />
                    </button>
                  )}
                </div>
                <div className="p-3 sm:p-4 md:p-5">
                  <div className="flex min-w-0 flex-col items-start gap-2">
                    <h3 className="w-full min-w-0 break-words font-semibold leading-snug">
                      {archived ? (
                        product.name
                      ) : (
                        // Stretched button: the whole card opens the editor.
                        <button
                          type="button"
                          onClick={() => onEdit(product)}
                          className="cursor-pointer text-left after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-[3px] focus-visible:after:ring-inset focus-visible:after:ring-ring/50"
                        >
                          {product.name}
                        </button>
                      )}
                    </h3>
                    <span
                      className={`shrink-0 rounded-full border px-2.5 py-1 text-xs ${product.published && !archived ? 'border-success/30 bg-success/10 text-foreground' : 'bg-muted text-muted-foreground'}`}
                    >
                      {archived
                        ? 'Archived'
                        : product.published
                          ? 'Published'
                          : 'Unpublished'}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-3 break-words text-sm text-muted-foreground">
                    {product.description}
                  </p>
                  <p className="mt-4 font-medium tabular-nums">
                    €{(product.priceCents / 100).toFixed(2)} /{' '}
                    {label(product.unit)}
                  </p>
                  <p
                    className={`mt-1 text-sm ${product.isLowStock ? 'font-medium text-destructive' : 'text-muted-foreground'}`}
                  >
                    {product.availableStock} available
                    {product.isLowStock ? ' · Low stock' : ''}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {query.data.total > query.data.limit && (
        <nav
          aria-label="Product pages"
          className="mt-5 flex items-center justify-between gap-3"
        >
          <p className="text-sm text-muted-foreground">
            Page {query.data.page} of{' '}
            {Math.ceil(query.data.total / query.data.limit)}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={page * query.data.limit >= query.data.total}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </Button>
          </div>
        </nav>
      )}
    </section>
  );
}

function ProductRoute({
  productId,
  onDone,
}: {
  productId: string;
  onDone: () => void;
}) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: [...productKey, productId],
    queryFn: () => fetchProduct(productId),
    retry: false,
  });
  if (query.isPending)
    return (
      <>
        <EditorHeader title="Edit product" onBack={onDone} />
        <Card className="p-6" role="status">
          Loading product…
        </Card>
      </>
    );
  if (query.isError && !query.data)
    return (
      <>
        <EditorHeader title="Edit product" onBack={onDone} />
        <Card className="p-6">
          <p role="alert" className="text-sm text-destructive">
            {errorCopy(query.error, 'load this product')}
          </p>
          <Button
            className="mt-4"
            variant="outline"
            onClick={() => void query.refetch()}
          >
            Try again
          </Button>
        </Card>
      </>
    );
  return (
    <>
      {query.isError && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          Product refresh failed. Your edits remain available, but the displayed
          revision may be out of date.
        </p>
      )}
      <ProductEditor
        product={query.data}
        onSaved={() => {
          void client.invalidateQueries({ queryKey: productKey });
          void client.invalidateQueries({ queryKey: producerMetricsKey });
          onDone();
        }}
      />
    </>
  );
}

/** Farm details buyers see; shown on the producer's account page. */
export function ProducerProfileEditor() {
  const query = useQuery({
    queryKey: profileKey,
    queryFn: fetchProfile,
    retry: false,
  });
  if (query.isPending)
    return (
      <Card className="p-6 text-sm text-muted-foreground" role="status">
        Loading your producer profile…
      </Card>
    );
  if (query.isError && !query.data)
    return (
      <Card className="p-6">
        <p role="alert" className="text-sm text-destructive">
          {errorCopy(query.error, 'load your profile')}
        </p>
        <Button
          className="mt-4"
          variant="outline"
          onClick={() => void query.refetch()}
        >
          Try again
        </Button>
      </Card>
    );
  return (
    <>
      <ProfileForm profile={query.data} />
      {query.isError && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          Profile refresh failed. Your edits remain available, but the displayed
          details may be out of date.
        </p>
      )}
    </>
  );
}

function ProfileForm({ profile }: { profile: Profile }) {
  const [baseProfile, setBaseProfile] = useState(profile);
  const [fieldError, setFieldError] = useState('');
  const [latitudeError, setLatitudeError] = useState('');
  const [longitudeError, setLongitudeError] = useState('');
  const [reloadError, setReloadError] = useState('');
  const client = useQueryClient();
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(false);
  const mutation = useMutation({
    mutationFn: ({
      profile,
      input,
    }: {
      profile: Profile;
      input: Omit<ProfileInput, 'revision'>;
    }) =>
      authenticatedRequest<Profile>('producer/profile', {
        method: 'PATCH',
        body: JSON.stringify({ ...input, revision: profile.revision }),
      }),
    onSuccess: async (profile) => {
      await client.cancelQueries({ queryKey: profileKey });
      client.setQueryData(profileKey, profile);
      setBaseProfile(profile);
      setNotice('Producer details saved.');
      setEditing(false);
    },
  });
  const form = useForm({
    defaultValues: {
      farmName: profile.farmName,
      description: profile.description,
      city: profile.city,
      collectionAddress: profile.collectionAddress,
      latitude: String(profile.latitude),
      longitude: String(profile.longitude),
    },
    onSubmit: async ({ value }) => {
      const latitude =
        value.latitude.trim() === '' ? Number.NaN : Number(value.latitude);
      const longitude =
        value.longitude.trim() === '' ? Number.NaN : Number(value.longitude);
      setLatitudeError(
        Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
          ? ''
          : 'Enter a latitude from -90 to 90.',
      );
      setLongitudeError(
        Number.isFinite(longitude) && longitude >= -180 && longitude <= 180
          ? ''
          : 'Enter a longitude from -180 to 180.',
      );
      if (
        !value.farmName.trim() ||
        !value.description.trim() ||
        !value.city.trim() ||
        !value.collectionAddress.trim() ||
        !Number.isFinite(latitude) ||
        latitude < -90 ||
        latitude > 90 ||
        !Number.isFinite(longitude) ||
        longitude < -180 ||
        longitude > 180
      ) {
        setFieldError(
          'Fill in every detail and pick your address on the map before saving.',
        );
        if (
          !Number.isFinite(latitude) ||
          latitude < -90 ||
          latitude > 90 ||
          !Number.isFinite(longitude) ||
          longitude < -180 ||
          longitude > 180
        )
          document.getElementById('profile-location')?.focus();
        return;
      }
      setFieldError('');
      setNotice('');
      try {
        await mutation.mutateAsync({
          profile: baseProfile,
          input: {
            farmName: value.farmName.trim(),
            description: value.description.trim(),
            city: value.city.trim(),
            collectionAddress: value.collectionAddress.trim(),
            latitude,
            longitude,
          },
        });
      } catch {
        /* The mutation alert keeps entered values visible. */
      }
    },
  });
  const reloadProfile = async () => {
    setReloadError('');
    try {
      const fresh = await fetchProfile();
      setBaseProfile(fresh);
      client.setQueryData(profileKey, fresh);
      mutation.reset();
    } catch {
      setReloadError(
        'Could not reload the current profile. Your form text remains here.',
      );
    }
  };
  return (
    <section className="mt-6" aria-labelledby="producer-details-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="producer-details-heading" className="text-xl font-semibold">
          Producer details
        </h2>
        {!editing && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setNotice('');
              setEditing(true);
            }}
          >
            <Pencil aria-hidden="true" /> Edit
          </Button>
        )}
      </div>
      <p className="mt-1 max-w-[65ch] text-sm text-muted-foreground">
        Shown on your farm page and used for collection arrangements.
      </p>
      {!editing && notice && (
        <p role="status" className="mt-4 text-sm text-primary">
          {notice}
        </p>
      )}
      {!editing && (
        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="text-muted-foreground">Farm name</dt>
            <dd className="mt-1 font-medium break-words">
              {baseProfile.farmName}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-muted-foreground">City</dt>
            <dd className="mt-1 break-words">{baseProfile.city}</dd>
          </div>
          <div className="min-w-0 sm:col-span-2">
            <dt className="text-muted-foreground">Collection address</dt>
            <dd className="mt-1 break-words">
              {baseProfile.collectionAddress}
            </dd>
          </div>
          <div className="min-w-0 sm:col-span-2">
            <dt className="text-muted-foreground">Farm practices and story</dt>
            <dd className="mt-1 max-w-[70ch] leading-relaxed whitespace-pre-line break-words">
              {baseProfile.description}
            </dd>
          </div>
        </dl>
      )}
      {editing && (
        <form
          className="mt-5 space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <form.Field name="farmName">
              {(field) => (
                <FormField
                  id="profile-farm-name"
                  label="Farm or enterprise name"
                >
                  <Input
                    id="profile-farm-name"
                    maxLength={120}
                    required
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </FormField>
              )}
            </form.Field>
            <form.Field name="city">
              {(field) => (
                <FormField id="profile-city" label="City or locality">
                  <Input
                    id="profile-city"
                    maxLength={120}
                    required
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </FormField>
              )}
            </form.Field>
            <form.Field name="collectionAddress">
              {(field) => (
                <FormField id="profile-address" label="Collection address">
                  <Input
                    id="profile-address"
                    maxLength={240}
                    required
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </FormField>
              )}
            </form.Field>
            <div className="md:col-span-2">
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
                    id="profile-location"
                    label="Map location"
                    description="Search for the address, then pick the right match."
                  >
                    <AddressSearch
                      id="profile-location"
                      initialQuery={address}
                      latitude={
                        latitude.trim() === '' ? null : Number(latitude)
                      }
                      longitude={
                        longitude.trim() === '' ? null : Number(longitude)
                      }
                      error={
                        latitudeError || longitudeError
                          ? 'Pick your address from the search results to place it on the map.'
                          : undefined
                      }
                      onPick={(match) => {
                        form.setFieldValue('latitude', String(match.latitude));
                        form.setFieldValue(
                          'longitude',
                          String(match.longitude),
                        );
                        if (!form.getFieldValue('city').trim() && match.city)
                          form.setFieldValue('city', match.city);
                        setLatitudeError('');
                        setLongitudeError('');
                      }}
                    />
                  </FormField>
                )}
              </form.Subscribe>
            </div>
          </div>
          <form.Field name="description">
            {(field) => (
              <FormField
                id="profile-description"
                label="Farm practices and story"
              >
                <Textarea
                  id="profile-description"
                  rows={4}
                  maxLength={2000}
                  required
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </FormField>
            )}
          </form.Field>
          {fieldError && (
            <p role="alert" className="text-sm text-destructive">
              {fieldError}
            </p>
          )}
          {mutation.isError && (
            <div role="alert" className="space-y-2 text-sm text-destructive">
              <p>{errorCopy(mutation.error, 'save your profile')}</p>
              {mutation.error instanceof ApiError &&
                mutation.error.status === 409 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void reloadProfile()}
                  >
                    Reload current profile
                  </Button>
                )}
            </div>
          )}
          {reloadError && (
            <p role="alert" className="text-sm text-destructive">
              {reloadError}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Save changes'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => {
                form.reset({
                  farmName: baseProfile.farmName,
                  description: baseProfile.description,
                  city: baseProfile.city,
                  collectionAddress: baseProfile.collectionAddress,
                  latitude: String(baseProfile.latitude),
                  longitude: String(baseProfile.longitude),
                });
                mutation.reset();
                setFieldError('');
                setLatitudeError('');
                setLongitudeError('');
                setEditing(false);
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

export function ProducerProducts({
  status,
}: {
  status: 'pending' | 'approved' | 'rejected' | 'suspended' | null;
}) {
  const navigate = useNavigate();
  const pathname = useLocation({ select: (location) => location.pathname });
  const routeParams = useParams({ strict: false });
  const isCreate = pathname.endsWith('/products/new');
  const editId =
    typeof routeParams.productId === 'string' &&
    routeParams.productId.length > 0
      ? routeParams.productId
      : undefined;
  const [selectedProduct, setSelectedProduct] = useState<Product>();
  if (status !== 'approved') return null;
  return (
    <section className="space-y-6" aria-labelledby="producer-products-title">
      {!isCreate && !editId && !selectedProduct && (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 id="producer-products-title" className="text-3xl md:text-4xl">
            Products
          </h1>
          <Button
            onClick={() => void navigate({ to: '/producer/products/new' })}
          >
            <Plus aria-hidden="true" /> Add product
          </Button>
        </div>
      )}
      {isCreate ? (
        <ProductEditor
          onSaved={() => void navigate({ to: '/producer/products' })}
        />
      ) : editId ? (
        <ProductRoute
          productId={editId}
          onDone={() => void navigate({ to: '/producer/products' })}
        />
      ) : selectedProduct ? (
        <ProductEditor
          key={`${selectedProduct.id}-${selectedProduct.revision}`}
          product={selectedProduct}
          onSaved={() => {
            setSelectedProduct(undefined);
          }}
        />
      ) : (
        <ProductList onEdit={setSelectedProduct} />
      )}
    </section>
  );
}
