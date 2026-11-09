@extends('layouts.app')

@section('title', 'Product moderation | DWC Backoffice')

@section('header-action')
    <form method="post" action="{{ route('logout') }}">@csrf<button class="quiet-button" type="submit">Sign out</button></form>
@endsection

@section('content')
<main class="workspace producer-workspace moderation-workspace">
    <div class="workspace-heading">
        <div><p class="eyebrow">Administration / Content</p><h1>Products</h1><p class="page-intro">Check a listing's current moderation and publication state before hiding it.</p></div>
        <div class="identity" aria-label="Signed-in administrator"><span class="identity-name">{{ session('admin_identity.name') }}</span><span class="role-label">Administrator</span></div>
    </div>

    <nav class="moderation-tabs" aria-label="Filter products by moderation state">
        @foreach ([\App\DTOs\ModerationState::All, \App\DTOs\ModerationState::Hidden] as $filter)
            <a class="filter-link @if ($state === $filter) is-active @endif" href="{{ route('moderation.products', ['state' => $filter->value]) }}" @if ($state === $filter) aria-current="page" @endif>{{ $filter === \App\DTOs\ModerationState::All ? 'All' : 'Hidden' }}</a>
        @endforeach
    </nav>

    <p class="moderation-count">{{ $total }} {{ \Illuminate\Support\Str::plural('product', $total) }} · Page {{ $page }}</p>
    @if ($items === [])
        <section class="empty-state moderation-empty"><div><h2>No products in this view</h2><p>Hidden products appear here once you hide one.</p></div></section>
    @else
        <section class="moderation-list" aria-label="Products">
            @foreach ($items as $item)
                <article class="moderation-row">
                    <div class="moderation-identity">
                        <a class="moderation-link" href="{{ route('moderation.product', $item->id) }}">{{ $item->name }}</a>
                        <span>{{ $item->producerName }} <span aria-hidden="true">·</span> {{ ucfirst(str_replace('_', ' ', $item->category)) }}</span>
                    </div>
                    <div class="moderation-state"><span class="list-label">Moderation</span><span @class(['status-pill', $item->moderation === null ? 'status-approved' : 'status-suspended'])>{{ $item->moderation === null ? 'Not hidden' : 'Hidden' }}</span></div>
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
