@extends('layouts.app')

@section('title', 'Reported reviews | DWC Backoffice')

@section('header-action')
    <form method="post" action="{{ route('logout') }}">@csrf<button class="quiet-button" type="submit">Sign out</button></form>
@endsection

@section('content')
<main class="workspace producer-workspace moderation-workspace">
    <a class="back-link" href="{{ route('home') }}">← Administration</a>
    <div class="workspace-heading">
        <div><p class="eyebrow">Administration / Content</p><h1>Reported reviews</h1><p class="page-intro">Reports are reviewed individually. The report count does not hide a review automatically.</p></div>
        <div class="identity" aria-label="Signed-in administrator"><span class="identity-name">{{ session('admin_identity.name') }}</span><span class="role-label">Administrator</span></div>
    </div>

    <nav class="moderation-tabs" aria-label="Filter reported reviews by visibility">
        @foreach (\App\DTOs\ModerationState::cases() as $filter)
            <a class="filter-link @if ($state === $filter) is-active @endif" href="{{ route('moderation.reviews', ['state' => $filter->value]) }}" @if ($state === $filter) aria-current="page" @endif>{{ match ($filter) { \App\DTOs\ModerationState::All => 'All reports', \App\DTOs\ModerationState::Visible => 'Visible reviews', \App\DTOs\ModerationState::Hidden => 'Hidden reviews' } }}</a>
        @endforeach
    </nav>

    <p class="moderation-count">{{ $total }} {{ \Illuminate\Support\Str::plural('reported review', $total) }} · Page {{ $page }}</p>
    @if ($items === [])
        <section class="empty-state moderation-empty"><div><h2>No reported reviews in this view</h2><p>Reported reviews appear here when a buyer or producer submits a report.</p></div></section>
    @else
        <section class="moderation-list" aria-label="Reported reviews">
            @foreach ($items as $item)
                <article class="moderation-row review-queue-row">
                    <div class="moderation-identity review-queue-content">
                        <a class="moderation-link" href="{{ route('moderation.review', $item->reviewId) }}">{{ $item->producer['farmName'] }}</a>
                        <span class="review-queue-comment">{{ $item->comment ?: 'No written comment' }}</span>
                        <span>By {{ $item->author['name'] }} · Order {{ $item->orderId }}</span>
                    </div>
                    <div class="moderation-meta"><span class="list-label">Rating</span><span>{{ $item->rating }} / 5</span></div>
                    <div class="moderation-meta"><span class="list-label">Reports</span><span>{{ $item->reportCount }}</span></div>
                    <div class="moderation-meta"><span class="list-label">Latest report</span><time datetime="{{ $item->latestReportAt }}">{{ $item->latestReportAt ? \Illuminate\Support\Carbon::parse($item->latestReportAt)->format('j M Y') : '—' }}</time></div>
                    <div class="moderation-state"><span class="list-label">Visibility</span><span @class(['status-pill', $item->visibility === 'visible' ? 'status-approved' : 'status-suspended'])>{{ ucfirst($item->visibility) }}</span></div>
                    <a class="row-action" href="{{ route('moderation.review', $item->reviewId) }}">Inspect<span class="sr-only"> review by {{ $item->author['name'] }}</span><span aria-hidden="true"> →</span></a>
                </article>
            @endforeach
        </section>
    @endif
    @include('moderation.pagination', ['routeName' => 'moderation.reviews'])
</main>
@endsection
