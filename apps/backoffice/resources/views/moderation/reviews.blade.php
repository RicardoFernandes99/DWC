@extends('layouts.app')

@section('title', 'Reported reviews | DWC Backoffice')

@section('content')
<main class="workspace producer-workspace moderation-workspace">
    <x-page-heading eyebrow="Administration / Content" title="Reported reviews">Reports are reviewed individually. The report count does not hide a review automatically.</x-page-heading>

    <x-tabs aria-label="Filter reported reviews by visibility">
        @foreach ([\App\DTOs\ModerationState::All, \App\DTOs\ModerationState::Hidden] as $filter)
            <x-tab :href="route('moderation.reviews', ['state' => $filter->value])" :active="$state === $filter">{{ $filter === \App\DTOs\ModerationState::All ? 'All' : 'Hidden' }}</x-tab>
        @endforeach
    </x-tabs>

    <p class="moderation-count">{{ $total }} {{ \Illuminate\Support\Str::plural('reported review', $total) }} · Page {{ $page }}</p>
    @if ($items === [])
        <x-empty-state title="No reported reviews in this view">Reported reviews appear here when a buyer or producer submits a report.</x-empty-state>
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
                    <div class="moderation-state"><span class="list-label">Visibility</span><x-status-pill :tone="$item->visibility === 'visible' ? 'approved' : 'suspended'">{{ ucfirst($item->visibility) }}</x-status-pill></div>
                    <a class="row-action" href="{{ route('moderation.review', $item->reviewId) }}">Inspect<span class="sr-only"> review by {{ $item->author['name'] }}</span><span aria-hidden="true"> →</span></a>
                </article>
            @endforeach
        </section>
    @endif
    @include('moderation.pagination', ['routeName' => 'moderation.reviews'])
</main>
@endsection
