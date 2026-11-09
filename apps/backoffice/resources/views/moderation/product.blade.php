@extends('layouts.app')

@section('title', $product->name.' | Product moderation')

@section('content')
<x-page>
    <x-back-link :href="route('moderation.products')">← Products</x-back-link>
    @if (session('notice'))<x-alert>{{ session('notice') }}</x-alert>@endif
    @if (isset($moderationError) || session('moderation_error'))
        <x-alert type="error">
            {{ $conflict ?? false ? 'This product changed while you were reviewing it.' : 'The API could not complete that action.' }} {{ $moderationError ?? session('moderation_error') }}
            @if ($conflict ?? false) The current server state and revision are shown below. Review them before submitting another decision.@endif
        </x-alert>
    @endif

    <x-page-heading eyebrow="Product moderation" :title="$product->name">
        {{ $product->producerName }} · {{ ucfirst(str_replace('_', ' ', $product->category)) }}
        <x-slot:aside><x-status-pill :tone="$product->moderation === null ? 'approved' : 'suspended'">{{ $product->moderation === null ? 'Not hidden' : 'Hidden' }}</x-status-pill></x-slot:aside>
    </x-page-heading>

    @if ($product->imageUrl)<img class="max-h-72 w-fit rounded-lg border object-cover" src="{{ $product->imageUrl }}" alt="Product image for {{ $product->name }}">@endif

    <x-section title="Current listing state">
        <x-slot:aside>Revision {{ $product->revision }}</x-slot:aside>
        <x-facts>
            <x-fact label="Published by producer">{{ $product->published ? 'Yes' : 'No' }}</x-fact>
            <x-fact label="Archived">{{ $product->archivedAt ? 'Yes, '.\Illuminate\Support\Carbon::parse($product->archivedAt)->format('j M Y') : 'No' }}</x-fact>
            <x-fact label="Available stock">{{ $product->availableStock }} {{ $product->unit }}</x-fact>
            <x-fact label="Reserved stock">{{ $product->reservedStock }} {{ $product->unit }}</x-fact>
            <x-fact label="Price">€{{ number_format($product->priceCents / 100, 2) }} / {{ $product->unit }}</x-fact>
            <x-fact label="Added"><time datetime="{{ $product->createdAt }}">{{ \Illuminate\Support\Carbon::parse($product->createdAt)->format('j F Y') }}</time></x-fact>
        </x-facts>
        <x-copy title="Description">{{ $product->description }}</x-copy>
        <p class="text-muted-foreground text-xs">Hiding changes moderation visibility only. It leaves the producer's publication choice, stock and auction records unchanged. Existing order snapshots keep their purchased product details.</p>
    </x-section>

    @if ($product->moderation)
        <x-note title="Current moderation record">
            Hidden <time datetime="{{ $product->moderation['hiddenAt'] }}">{{ \Illuminate\Support\Carbon::parse($product->moderation['hiddenAt'])->format('j F Y, H:i') }}</time>
            @if ($product->moderation['reason'])<br><strong>Reason:</strong> {{ $product->moderation['reason'] }}@endif
        </x-note>
        @if (($conflict ?? false) && $draft)<x-note title="Your reason draft is saved from the previous attempt.">{{ $draft['reason'] }}</x-note>@endif
    @elseif ($product->published && $product->archivedAt === null)
        <p class="text-muted-foreground text-sm">This listing is published and not archived. Public availability also depends on the producer's current approval.</p>
    @endif

    @if ($product->moderation === null)
        <x-section title="Hide this product">
            <p class="text-muted-foreground text-sm">Hiding removes it from public product views and checkout. It does not suspend the producer or release auction stock. The producer receives a notification with your reason.</p>
            <x-confirm summary="Review hide decision" :open="$draft || $errors->has('reason')">
                <x-reason-form
                    :action="route('moderation.hide', ['kind' => 'product', 'id' => $product->id])"
                    :revision="$product->revision"
                    id="moderation-reason"
                    label="Reason for hiding this product"
                    help="This reason is recorded on the product and sent to the producer. Maximum 500 characters."
                    submit="Confirm hide product"
                    :value="$draft['reason'] ?? ''">
                    <p class="text-muted-foreground text-sm">Confirming hides the product from public listings and checkout. Publication, inventory, existing orders and auctions remain unchanged.</p>
                </x-reason-form>
            </x-confirm>
        </x-section>
    @endif
</x-page>
@endsection
