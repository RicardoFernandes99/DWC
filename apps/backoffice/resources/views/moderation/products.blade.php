@extends('layouts.app')

@section('title', 'Product moderation | DWC Backoffice')

@section('content')
<main class="workspace producer-workspace moderation-workspace">
    <x-page-heading eyebrow="Administration / Content" title="Products">Check a listing's current moderation and publication state before hiding it.</x-page-heading>

    <x-tabs aria-label="Filter products by moderation state">
        @foreach ([\App\DTOs\ModerationState::All, \App\DTOs\ModerationState::Hidden] as $filter)
            <x-tab :href="route('moderation.products', ['state' => $filter->value])" :active="$state === $filter">{{ $filter === \App\DTOs\ModerationState::All ? 'All' : 'Hidden' }}</x-tab>
        @endforeach
    </x-tabs>

    <p class="moderation-count">{{ $total }} {{ \Illuminate\Support\Str::plural('product', $total) }} · Page {{ $page }}</p>
    @if ($items === [])
        <x-empty-state title="No products in this view">Hidden products appear here once you hide one.</x-empty-state>
    @else
        <section class="moderation-list" aria-label="Products">
            @foreach ($items as $item)
                <article class="moderation-row">
                    <div class="moderation-identity">
                        <a class="moderation-link" href="{{ route('moderation.product', $item->id) }}">{{ $item->name }}</a>
                        <span>{{ $item->producerName }} <span aria-hidden="true">·</span> {{ ucfirst(str_replace('_', ' ', $item->category)) }}</span>
                    </div>
                    <div class="moderation-state"><span class="list-label">Moderation</span><x-status-pill :tone="$item->moderation === null ? 'approved' : 'suspended'">{{ $item->moderation === null ? 'Not hidden' : 'Hidden' }}</x-status-pill></div>
                    <div class="moderation-publication"><span class="list-label">Published by producer</span><span>{{ $item->published ? 'Yes' : 'No' }}</span></div>
                    <div class="moderation-created"><span class="list-label">Added</span><time datetime="{{ $item->createdAt }}">{{ \Illuminate\Support\Carbon::parse($item->createdAt)->format('j M Y') }}</time></div>
                    <a class="row-action" href="{{ route('moderation.product', $item->id) }}">Inspect<span class="sr-only"> {{ $item->name }}</span><span aria-hidden="true"> →</span></a>
                </article>
            @endforeach
        </section>
    @endif
    @include('moderation.pagination', ['routeName' => 'moderation.products'])
</main>
@endsection
