@extends('layouts.app')

@section('title', 'Reported review | Review moderation')

@section('content')
<main class="workspace producer-workspace moderation-workspace">
    <x-back-link :href="route('moderation.reviews')">← Reported reviews</x-back-link>
    @if (session('notice'))<x-alert>{{ session('notice') }}</x-alert>@endif
    @if (isset($moderationError) || session('moderation_error'))
        <div class="form-error decision-error" role="alert"><p>{{ $conflict ?? false ? 'This review changed while you were reviewing it.' : 'The API could not complete that action.' }} {{ $moderationError ?? session('moderation_error') }}</p>@if ($conflict ?? false)<p>The current server state and revision are shown below. Review them before submitting another decision.</p>@endif</div>
    @endif
    <header class="detail-heading moderation-detail-heading">
        <div><p class="eyebrow">Review moderation</p><h1>Reported review</h1><p class="detail-owner">{{ $review->producer['farmName'] }}</p><p class="detail-owner">Written by {{ $review->author['name'] }} <span aria-hidden="true">·</span> Order {{ $review->orderId }}</p></div>
        <div class="detail-status"><span class="list-label">Review visibility</span><x-status-pill :tone="$review->visibility === 'visible' ? 'approved' : 'suspended'">{{ ucfirst($review->visibility) }}</x-status-pill></div>
    </header>

    <section class="detail-section" aria-labelledby="review-content-title">
        <div class="section-heading"><h2 id="review-content-title">Review content</h2><span class="revision-label">Revision {{ $review->revision }}</span></div>
        <p class="review-rating" aria-label="Rating: {{ $review->rating }} out of 5">{{ $review->rating }} <span>/ 5</span></p>
        <div class="plain-content review-comment"><h3>Comment</h3><p>{{ $review->comment ?: 'No written comment.' }}</p></div>
        <p class="detail-owner">Submitted <time datetime="{{ $review->reviewCreatedAt }}">{{ \Illuminate\Support\Carbon::parse($review->reviewCreatedAt)->format('j F Y, H:i') }}</time></p>
        @if ($review->moderation)
            <div class="reason-note current-review-moderation"><h2>Current moderation record</h2><p>Hidden <time datetime="{{ $review->moderation['hiddenAt'] }}">{{ \Illuminate\Support\Carbon::parse($review->moderation['hiddenAt'])->format('j F Y, H:i') }}</time></p>@if ($review->moderation['reason'])<p><strong>Reason:</strong> {{ $review->moderation['reason'] }}</p>@endif</div>
            @if (($conflict ?? false) && $draft)<div class="draft-reason" role="status"><strong>Your reason draft is saved from the previous attempt.</strong><p>{{ $draft['reason'] }}</p></div>@endif
        @endif
    </section>

    <section class="detail-section" aria-labelledby="reports-title">
        <div class="section-heading"><h2 id="reports-title">Reports</h2><span class="revision-label">{{ $review->reportCount }} total · latest {{ $review->latestReportAt ? \Illuminate\Support\Carbon::parse($review->latestReportAt)->format('j M Y') : '—' }}</span></div>
        @if ($review->reports === [])<p class="section-copy">No report details are available.</p>@else
            <ol class="report-list">
                @foreach ($review->reports as $report)
                    <li class="report-entry"><div class="report-heading"><strong>{{ ucfirst(str_replace('_', ' ', $report['category'])) }}</strong><time datetime="{{ $report['createdAt'] }}">{{ \Illuminate\Support\Carbon::parse($report['createdAt'])->format('j F Y, H:i') }}</time></div><p>Reported by {{ $report['reporter']['name'] }}</p><p class="report-note">{{ $report['note'] ?: 'No additional note.' }}</p></li>
                @endforeach
            </ol>
            @if ($review->reportCount > count($review->reports))<p class="field-help">Showing the 100 most recent report details.</p>@endif
        @endif
    </section>
    <p class="history-note">Hiding removes this review from public review lists and rating totals. Report details and reporter identity are visible only in this administrator view.</p>

    @if ($review->visibility === 'visible')
        <section class="detail-section moderation-action-section" aria-labelledby="moderation-action-title">
            <div class="section-heading"><h2 id="moderation-action-title">Hide this review</h2></div>
            <p class="section-copy">The review and its report context remain stored. Hiding does not remove the review from the buyer's order record.</p>
            <details class="confirmation-disclosure" @if ($draft || ($errors->has('reason'))) open @endif>
                <summary>Review hide decision</summary>
                <div class="confirmation-content">
                    <form method="post" action="{{ route('moderation.hide', ['kind' => 'review', 'id' => $review->reviewId]) }}" class="reason-form">
                        @csrf<input type="hidden" name="revision" value="{{ $review->revision }}">
                        <div class="field"><label for="moderation-reason">Reason for hiding this review</label><textarea id="moderation-reason" name="reason" rows="4" maxlength="500" required aria-describedby="moderation-reason-help moderation-reason-error">{{ $draft['reason'] ?? '' }}</textarea><span class="field-help" id="moderation-reason-help">This reason is recorded on the review. Maximum 500 characters.</span>@error('reason')<span class="field-error" id="moderation-reason-error">{{ $message }}</span>@enderror</div>
                        <p class="confirmation-copy">Confirming hides this review from public review lists and rating totals.</p>
                        <button class="danger-button" type="submit">Confirm hide review</button>
                    </form>
                </div>
            </details>
        </section>
    @endif
</main>
@endsection
