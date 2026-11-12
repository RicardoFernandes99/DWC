@extends('layouts.app')

@section('title', $application->application['farmName'].' | Producer review')

@section('content')
<x-page>
    <x-back-link :href="route('producer-applications.index')">← Producer applications</x-back-link>

    @if (session('notice'))
        <x-alert>{{ session('notice') }}</x-alert>
    @endif
    @if (session('decision_error'))
        <x-alert type="error">
            {{ session('decision_conflict') ? 'This record changed while you were reviewing it.' : 'The API could not complete that action.' }} {{ session('decision_error') }}
            @if (session('decision_conflict'))
                The current server status and revision are shown below. Review them before submitting another decision.
            @endif
        </x-alert>
    @endif

    <x-page-heading eyebrow="Producer application" :title="$application->application['farmName']">
        {{ $application->name }} · <a class="underline underline-offset-4" href="mailto:{{ $application->email }}">{{ $application->email }}</a>
        <x-slot:aside><x-status-pill :tone="$application->status->value">{{ $application->status->label() }}</x-status-pill></x-slot:aside>
    </x-page-heading>

    @if ($decisionDraft)
        <x-note title="Your reason draft is saved from the previous attempt.">
            {{ old('reason', $decisionDraft['reason']) }}
            <form method="post" action="{{ route('producer-applications.discard-draft', $application->id) }}" class="mt-2">
                @csrf
                <x-ui.button type="submit" variant="outline" size="sm">Discard saved reason</x-ui.button>
            </form>
        </x-note>
    @endif

    <x-section title="Farm and collection details">
        <x-slot:aside>Submitted {{ \Illuminate\Support\Carbon::parse($application->submittedAt)->format('j F Y') }}</x-slot:aside>
        <div class="grid gap-6 md:grid-cols-2">
            <x-copy title="Location">
                <p>{{ $application->application['city'] }}</p>
                <p>{{ $application->application['collectionAddress'] }}</p>
                <p class="text-xs">{{ number_format((float) $application->application['latitude'], 4) }}, {{ number_format((float) $application->application['longitude'], 4) }}</p>
            </x-copy>
            <x-copy title="About this farm">{{ $application->application['description'] }}</x-copy>
        </div>
    </x-section>

    @if ($application->rejectionReason)
        <x-note title="Previous review reason">{{ $application->rejectionReason }}</x-note>
    @endif

    <x-section title="Review for selling access">
        <x-slot:aside>Revision {{ $application->revision }}</x-slot:aside>
        @if ($application->status === \App\DTOs\ProducerApplicationStatus::Pending)
            <p class="text-muted-foreground text-sm">Approval lets this producer publish and sell. Rejection sends the reason to the producer and allows them to correct and resubmit.</p>
            <div class="grid gap-6 md:grid-cols-2">
                <form method="post" action="{{ route('producer-applications.approve', $application->id) }}">
                    @csrf
                    <input type="hidden" name="revision" value="{{ $application->revision }}">
                    <x-ui.button type="submit">Approve application</x-ui.button>
                </form>
                <x-reason-form
                    :action="route('producer-applications.reject', $application->id)"
                    :revision="$application->revision"
                    id="rejection-reason"
                    label="Reason for rejection"
                    help="The producer can use this feedback to correct and resubmit. Maximum 500 characters."
                    submit="Reject application"
                    :danger="false"
                    :value="$decisionDraft && $decisionDraft['action'] === 'reject' ? $decisionDraft['reason'] : ''" />
            </div>
        @else
            <p class="text-muted-foreground text-sm">This application is {{ $application->status->value }}. Application decisions are separate from account standing.</p>
        @endif
    </x-section>

    <x-section title="Producer selling access">
        <x-slot:aside><x-status-pill :tone="$application->status->value">{{ $application->status->label() }}</x-status-pill></x-slot:aside>
        @if ($application->status === \App\DTOs\ProducerApplicationStatus::Approved)
            <p class="text-muted-foreground text-sm">Suspension hides normal-sale products and blocks new sales and auctions. Existing orders can still be fulfilled and active auctions continue.</p>
            <x-confirm summary="Suspend this producer">
                <p class="text-sm">Suspension blocks new sales and auction creation, and hides normal-sale products from buyers. Existing orders remain available and active auctions continue.</p>
                <x-reason-form
                    :action="route('producer-applications.suspend', $application->id)"
                    :revision="$application->revision"
                    id="suspension-reason"
                    label="Reason for suspension"
                    help="This reason is shown to the producer. Maximum 500 characters."
                    submit="Confirm suspension"
                    :value="$decisionDraft && $decisionDraft['action'] === 'suspend' ? $decisionDraft['reason'] : ''" />
            </x-confirm>
        @elseif ($application->status === \App\DTOs\ProducerApplicationStatus::Suspended)
            <p class="text-muted-foreground text-sm">The producer cannot sell or create auctions while suspended. Reinstatement returns the account to approved; it does not change product publication or moderation decisions.</p>
            @if ($application->suspensionReason)
                <x-note title="Current suspension reason">{{ $application->suspensionReason }}</x-note>
            @endif
            <x-confirm summary="Reinstate this producer">
                <p class="text-sm">Reinstatement returns the account to approved. Products become visible only if they are already published and not moderated or archived. Existing orders and auction records remain in place.</p>
                <form method="post" action="{{ route('producer-applications.reinstate', $application->id) }}">
                    @csrf
                    <input type="hidden" name="revision" value="{{ $application->revision }}">
                    <x-ui.button type="submit">Confirm reinstatement</x-ui.button>
                </form>
            </x-confirm>
        @else
            <p class="text-muted-foreground text-sm">Suspension is available only for approved producers. It does not change an application that is pending or rejected.</p>
        @endif
    </x-section>
</x-page>
@endsection
