import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate, useParams } from '@tanstack/react-router';
import { Archive, Pencil, Plus, Sprout } from 'lucide-react';
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
import { PackagePlus } from 'lucide-react';

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

function fetchProducts(page: number) {
  return authenticatedRequest<ProductListResponse>(
    `producer/products?page=${page}&limit=50`,
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
  const client = useQueryClient();
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
  return (
    <Card className="p-5 md:p-6">
      <h2 className="text-xl font-semibold">
        {baseProduct ? 'Edit product' : 'New product'}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Prices use euros and cents. Stock and warning levels use whole units.
      </p>
      <form
        className="mt-6 space-y-5"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <form.Field name="name">
            {(field) => (
              <FormField id="product-name" label="Product name">
                <Input
                  id="product-name"
                  required
                  maxLength={120}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </FormField>
            )}
          </form.Field>
          <form.Field name="category">
            {(field) => (
              <FormField id="product-category" label="Category">
                <select
                  id="product-category"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
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
                </select>
              </FormField>
            )}
          </form.Field>
          <form.Field name="productionMethod">
            {(field) => (
              <FormField id="product-method" label="Production method">
                <select
                  id="product-method"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value as Method)}
                >
                  {methods.map((item) => (
                    <option key={item} value={item}>
                      {label(item)}
                    </option>
                  ))}
                </select>
              </FormField>
            )}
          </form.Field>
          <form.Field name="unit">
            {(field) => (
              <FormField id="product-unit" label="Sold per">
                <select
                  id="product-unit"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value as Unit)}
                >
                  {units.map((item) => (
                    <option key={item} value={item}>
                      {label(item)}
                    </option>
                  ))}
                </select>
              </FormField>
            )}
          </form.Field>
        </div>
        <form.Field name="description">
          {(field) => (
            <FormField id="product-description" label="Description">
              <Textarea
                id="product-description"
                required
                rows={4}
                maxLength={2000}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </FormField>
          )}
        </form.Field>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">
            Available seasons
          </legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {seasons.map((season) => (
              <form.Field key={season} name="seasons">
                {(field) => (
                  <label className="inline-flex min-h-11 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={field.state.value.includes(season)}
                      onChange={(e) =>
                        field.handleChange(
                          e.target.checked
                            ? [...field.state.value, season]
                            : field.state.value.filter(
                                (item) => item !== season,
                              ),
                        )
                      }
                    />
                    {label(season)}
                  </label>
                )}
              </form.Field>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-3">
          <form.Field name="price">
            {(field) => (
              <FormField id="product-price" label="Price (€)">
                <Input
                  id="product-price"
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  required
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </FormField>
            )}
          </form.Field>
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
                label="Low-stock warning at"
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
            <label className="inline-flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={field.state.value}
                onChange={(e) => field.handleChange(e.target.checked)}
              />
              Published in the catalogue
            </label>
          )}
        </form.Field>
        <FormField
          id="product-image"
          label={
            baseProduct?.hasImage ? 'Replace product image' : 'Product image'
          }
          description="JPEG, PNG, or WebP. Maximum 5 MB."
        >
          <Input
            id="product-image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setSelectedFile(e.target.files?.[0])}
          />
        </FormField>
        {selectedFile && (
          <p className="text-sm text-muted-foreground">
            Selected: {selectedFile.name} ({Math.ceil(selectedFile.size / 1024)}{' '}
            KB)
          </p>
        )}
        {fieldError && (
          <p role="alert" className="text-sm text-destructive">
            {fieldError}
          </p>
        )}
        {save.isError && (
          <div
            role="alert"
            className="space-y-2 rounded-lg border border-destructive/30 p-4 text-sm"
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
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending
              ? 'Saving…'
              : baseProduct
                ? 'Save changes'
                : 'Create product'}
          </Button>
          <Button type="button" variant="outline" onClick={onSaved}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
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
  const client = useQueryClient();
  const query = useQuery({
    queryKey: [...productKey, page],
    queryFn: () => fetchProducts(page),
    retry: false,
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
  return (
    <section aria-labelledby="products-heading">
      {query.isError && query.data && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          Product refresh failed. The saved list may be out of date.
        </p>
      )}
      <p id="products-heading" className="text-sm text-muted-foreground">
        {query.data.total} active listing{query.data.total === 1 ? '' : 's'}
      </p>
      {archive.isError && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {errorCopy(archive.error, 'archive the product')}
        </p>
      )}
      {query.data.items.length === 0 ? (
        <EmptyState
          className="mt-5"
          headingLevel="h3"
          icon={<PackagePlus />}
          title="Your first product starts here"
          description="Add a product with its price, unit, stock, season and a clear description. You can attach an image while creating it."
        />
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4">
          {query.data.items.map((product) => (
            <Card key={product.id} className="min-w-0 overflow-hidden">
              <ProductImage
                key={`${product.id}-${product.revision}-${product.imageUrl ?? ''}`}
                product={product}
              />
              <div className="p-3 sm:p-4 md:p-5">
                <div className="flex min-w-0 flex-col items-start gap-2">
                  <h3 className="w-full min-w-0 break-words font-semibold leading-snug">
                    {product.name}
                  </h3>
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-xs ${product.published ? 'border-success/30 bg-success/10 text-foreground' : 'bg-muted text-muted-foreground'}`}
                  >
                    {product.published ? 'Published' : 'Unpublished'}
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
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onEdit(product)}
                  >
                    <Pencil aria-hidden="true" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={archive.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Archive “${product.name}”? It will be unpublished and cannot be restored from this screen.`,
                        )
                      )
                        archive.mutate(product);
                    }}
                  >
                    <Archive aria-hidden="true" /> Archive
                  </Button>
                </div>
              </div>
            </Card>
          ))}
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
      <Card className="p-6" role="status">
        Loading product…
      </Card>
    );
  if (query.isError && !query.data)
    return (
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
      setNotice('Profile changes saved.');
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
          'Enter all profile details and valid coordinates before saving.',
        );
        if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)
          document.getElementById('profile-latitude')?.focus();
        else if (
          !Number.isFinite(longitude) ||
          longitude < -180 ||
          longitude > 180
        )
          document.getElementById('profile-longitude')?.focus();
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
    <details className="mt-8 border-t pt-6">
      <summary className="cursor-pointer text-lg font-semibold focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
        Producer profile
      </summary>
      <p className="mt-2 max-w-[65ch] text-sm text-muted-foreground">
        These details appear on your producer profile and support collection
        arrangements.
      </p>
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
              <FormField id="profile-farm-name" label="Farm or enterprise name">
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
          <div className="grid grid-cols-2 gap-4">
            <form.Field name="latitude">
              {(field) => (
                <FormField
                  id="profile-latitude"
                  label="Latitude"
                  error={latitudeError}
                >
                  <Input
                    id="profile-latitude"
                    type="number"
                    min="-90"
                    max="90"
                    step="any"
                    required
                    aria-invalid={Boolean(latitudeError)}
                    aria-describedby={
                      latitudeError ? 'profile-latitude-error' : undefined
                    }
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </FormField>
              )}
            </form.Field>
            <form.Field name="longitude">
              {(field) => (
                <FormField
                  id="profile-longitude"
                  label="Longitude"
                  error={longitudeError}
                >
                  <Input
                    id="profile-longitude"
                    type="number"
                    min="-180"
                    max="180"
                    step="any"
                    required
                    aria-invalid={Boolean(longitudeError)}
                    aria-describedby={
                      longitudeError ? 'profile-longitude-error' : undefined
                    }
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </FormField>
              )}
            </form.Field>
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
        {notice && (
          <p role="status" className="text-sm text-primary">
            {notice}
          </p>
        )}
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : 'Save profile'}
        </Button>
      </form>
    </details>
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 id="producer-products-title" className="text-3xl md:text-4xl">
          {isCreate ? 'Add product' : editId ? 'Edit product' : 'Products'}
        </h1>
        {!isCreate && !editId && status === 'approved' && (
          <Button
            onClick={() => void navigate({ to: '/producer/products/new' })}
          >
            <Plus aria-hidden="true" /> Add product
          </Button>
        )}
      </div>
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
