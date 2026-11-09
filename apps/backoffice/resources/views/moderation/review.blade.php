@extends('layouts.app')

@section('title', 'Reported review | Review moderation')

@section('content')
<x-page>
    <x-back-link :href="route('moderation.reviews')">← Reported reviews</x-back-link>
    @if (session('notice'))<x-alert>{{ session('notice') }}</x-alert>@endif
    @if (isset($moderationError) || session('moderation_error'))
        <x-alert type="error">
            {{ $conflict ?? false ? 'This review changed while you were reviewing it.' : 'The API could not complete that action.' }} {{ $moderationError ?? session('moderation_error') }}
            @if ($conflict ?? false) The current server state and revision are shown below. Review them before submitting another decision.@endif
        </x-alert>
    @endif

    <x-page-heading eyebrow="Review moderation" title="Reported review">
        {{ $review->producer['farmName'] }} · Written by {{ $review->author['name'] }} · Order {{ $review->orderId }}
        <x-slot:aside><x-status-pill :tone="$review->visibility">{{ ucfirst($review->visibility) }}</x-status-pill></x-slot:aside>
    </x-page-heading>

    <x-section title="Review content">
        <x-slot:aside>Revision {{ $review->revision }}</x-slot:aside>
        <p class="text-2xl" aria-label="Rating: {{ $review->rating }} out of 5">{{ $review->rating }} <span class="text-muted-foreground text-base">/ 5</span></p>
        <x-copy title="Comment">{{ $review->comment ?: 'No written comment.' }}</x-copy>
        <p class="text-muted-foreground text-xs">Submitted <time datetime="{{ $review->reviewCreatedAt }}">{{ \Illuminate\Support\Carbon::parse($review->reviewCreatedAt)->format('j F Y, H:i') }}</time></p>
        @if ($review->moderation)
            <x-note title="Current moderation record">
                Hidden <time datetime="{{ $review->moderation['hiddenAt'] }}">{{ \Illuminate\Support\Carbon::parse($review->moderation['hiddenAt'])->format('j F Y, H:i') }}</time>
                @if ($review->moderation['reason'])<br><strong>Reason:</strong> {{ $review->moderation['reason'] }}@endif
            </x-note>
            @if (($conflict ?? false) && $draft)<x-note title="Your reason draft is saved from the previous attempt.">{{ $draft['reason'] }}</x-note>@endif
        @endif
    </x-section>

    <x-section title="Reports">
        <x-slot:aside>{{ $review->reportCount }} total · latest {{ $review->latestReportAt ? \Illuminate\Support\Carbon::parse($review->latestReportAt)->format('j M Y') : '—' }}</x-slot:aside>
        @if ($review->reports === [])
            <p class="text-muted-foreground text-sm">No report details are available.</p>
        @else
            <ol class="flex flex-col divide-y">
                @foreach ($review->reports as $report)
                    <li class="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                        <div class="flex flex-wrap justify-between gap-2"><strong class="text-sm">{{ ucfirst(str_replace('_', ' ', $report['category'])) }}</strong><time class="text-muted-foreground text-xs" datetime="{{ $report['createdAt'] }}">{{ \Illuminate\Support\Carbon::parse($report['createdAt'])->format('j F Y, H:i') }}</time></div>
                        <p class="text-muted-foreground text-xs">Reported by {{ $report['reporter']['name'] }}</p>
                        <p class="text-sm">{{ $report['note'] ?: 'No additional note.' }}</p>
                    </li>
                @endforeach
            </ol>
            @if ($review->reportCount > count($review->reports))<p class="text-muted-foreground text-xs">Showing the 100 most recent report details.</p>@endif
        @endif
    </x-section>
    <p class="text-muted-foreground text-xs">Hiding removes this review from public review lists and rating totals. Report details and reporter identity are visible only in this administrator view.</p>

    @if ($review->visibility === 'visible')
        <x-section title="Hide this review">
            <p class="text-muted-foreground text-sm">The review and its report context remain stored. Hiding does not remove the review from the buyer's order record.</p>
            <x-confirm summary="Review hide decision" :open="$draft || $errors->has('reason')">
                <x-reason-form
                    :action="route('moderation.hide', ['kind' => 'review', 'id' => $review->reviewId])"
                    :revision="$review->revision"
                    id="moderation-reason"
                    label="Reason for hiding this review"
                    help="This reason is recorded on the review. Maximum 500 characters."
                    submit="Confirm hide review"
                    :value="$draft['reason'] ?? ''">
                    <p class="text-muted-foreground text-sm">Confirming hides this review from public review lists and rating totals.</p>
                </x-reason-form>
            </x-confirm>
        </x-section>
    @endif
</x-page>
@endsection
