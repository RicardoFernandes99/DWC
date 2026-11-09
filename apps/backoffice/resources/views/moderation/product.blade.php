@extends('layouts.app')

@section('title', $product->name.' | Product moderation')

@section('content')
<main class="workspace producer-workspace moderation-workspace">
    <x-back-link :href="route('moderation.products')">← Products</x-back-link>
    @if (session('notice'))<x-alert>{{ session('notice') }}</x-alert>@endif
    @if (isset($moderationError) || session('moderation_error'))
        <div class="form-error decision-error" role="alert"><p>{{ $conflict ?? false ? 'This product changed while you were reviewing it.' : 'The API could not complete that action.' }} {{ $moderationError ?? session('moderation_error') }}</p>@if ($conflict ?? false)<p>The current server state and revision are shown below. Review them before submitting another decision.</p>@endif</div>
    @endif
    <header class="detail-heading moderation-detail-heading">
        <div><p class="eyebrow">Product moderation</p><h1>{{ $product->name }}</h1><p class="detail-owner">{{ $product->producerName }} <span aria-hidden="true">·</span> {{ ucfirst(str_replace('_', ' ', $product->category)) }}</p></div>
        <div class="detail-status"><span class="list-label">Moderation state</span><x-status-pill :tone="$product->moderation === null ? 'approved' : 'suspended'">{{ $product->moderation === null ? 'Not hidden' : 'Hidden' }}</x-status-pill></div>
    </header>
    @if ($product->imageUrl)<figure class="moderation-product-image"><img src="{{ $product->imageUrl }}" alt="Product image for {{ $product->name }}"></figure>@endif

    <section class="detail-section" aria-labelledby="product-state-title">
        <div class="section-heading"><h2 id="product-state-title">Current listing state</h2><span class="revision-label">Revision {{ $product->revision }}</span></div>
        <dl class="moderation-facts">
            <x-fact label="Published by producer">{{ $product->published ? 'Yes' : 'No' }}</x-fact>
            <x-fact label="Archived">{{ $product->archivedAt ? 'Yes, '.\Illuminate\Support\Carbon::parse($product->archivedAt)->format('j M Y') : 'No' }}</x-fact>
            <x-fact label="Available stock">{{ $product->availableStock }} {{ $product->unit }}</x-fact>
            <x-fact label="Reserved stock">{{ $product->reservedStock }} {{ $product->unit }}</x-fact>
            <x-fact label="Price">€{{ number_format($product->priceCents / 100, 2) }} / {{ $product->unit }}</x-fact>
            <x-fact label="Added"><time datetime="{{ $product->createdAt }}">{{ \Illuminate\Support\Carbon::parse($product->createdAt)->format('j F Y') }}</time></x-fact>
        </dl>
        <div class="plain-content moderation-description"><h3>Description</h3><p>{{ $product->description }}</p></div>
        <p class="history-note">Hiding changes moderation visibility only. It leaves the producer's publication choice, stock and auction records unchanged. Existing order snapshots keep their purchased product details.</p>
    </section>

    @if ($product->moderation)
        <section class="reason-note" aria-labelledby="current-hide-title"><h2 id="current-hide-title">Current moderation record</h2><p><strong>Hidden:</strong> <time datetime="{{ $product->moderation['hiddenAt'] }}">{{ \Illuminate\Support\Carbon::parse($product->moderation['hiddenAt'])->format('j F Y, H:i') }}</time></p>@if ($product->moderation['reason'])<p><strong>Reason:</strong> {{ $product->moderation['reason'] }}</p>@endif</section>
        @if (($conflict ?? false) && $draft)<div class="draft-reason" role="status"><strong>Your reason draft is saved from the previous attempt.</strong><p>{{ $draft['reason'] }}</p></div>@endif
    @elseif ($product->published && $product->archivedAt === null)
        <p class="history-note">This listing is published and not archived. Public availability also depends on the producer's current approval.</p>
    @endif

    @if ($product->moderation === null)
        <section class="detail-section moderation-action-section" aria-labelledby="moderation-action-title">
            <div class="section-heading"><h2 id="moderation-action-title">Hide this product</h2></div>
            <p class="section-copy">Hiding removes it from public product views and checkout. It does not suspend the producer or release auction stock. The producer receives a notification with your reason.</p>
            <details class="confirmation-disclosure" @if ($draft || ($errors->has('reason'))) open @endif>
                <summary>Review hide decision</summary>
                <div class="confirmation-content">
                    <form method="post" action="{{ route('moderation.hide', ['kind' => 'product', 'id' => $product->id]) }}" class="reason-form">
                        @csrf<input type="hidden" name="revision" value="{{ $product->revision }}">
                        <div class="field"><label for="moderation-reason">Reason for hiding this product</label><textarea id="moderation-reason" name="reason" rows="4" maxlength="500" required aria-describedby="moderation-reason-help moderation-reason-error">{{ $draft['reason'] ?? '' }}</textarea><span class="field-help" id="moderation-reason-help">This reason is recorded on the product and sent to the producer. Maximum 500 characters.</span>@error('reason')<span class="field-error" id="moderation-reason-error">{{ $message }}</span>@enderror</div>
                        <p class="confirmation-copy">Confirming hides the product from public listings and checkout. Publication, inventory, existing orders and auctions remain unchanged.</p>
                        <button class="danger-button" type="submit">Confirm hide product</button>
                    </form>
                </div>
            </details>
        </section>
    @endif
</main>
@endsection
