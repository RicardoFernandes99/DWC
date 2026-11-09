@extends('layouts.app')

@section('title', $application->application['farmName'].' | Producer review')

@section('content')
<main class="workspace producer-workspace">
    <x-back-link :href="route('producer-applications.index')">← Producer applications</x-back-link>

    @if (session('notice'))
        <x-alert>{{ session('notice') }}</x-alert>
    @endif
    @if (session('decision_error'))
        <div class="form-error decision-error" role="alert">
            <p>{{ session('decision_conflict') ? 'This record changed while you were reviewing it.' : 'The API could not complete that action.' }} {{ session('decision_error') }}</p>
            @if (session('decision_conflict'))
                <p>The current server status and revision are shown below. Review them before submitting another decision.</p>
            @endif
        </div>
    @endif

    <header class="detail-heading">
        <div>
            <p class="eyebrow">Producer application</p>
            <h1>{{ $application->application['farmName'] }}</h1>
            <p class="detail-owner">{{ $application->name }} <span aria-hidden="true">·</span> <a href="mailto:{{ $application->email }}">{{ $application->email }}</a></p>
        </div>
        <div class="detail-status">
            <span class="list-label">Current application status</span>
            <x-status-pill :tone="$application->status->value">{{ $application->status->label() }}</x-status-pill>
        </div>
    </header>

    @if ($decisionDraft)
        <div class="draft-reason" role="status">
            <strong>Your reason draft is saved from the previous attempt.</strong>
            <p>{{ old('reason', $decisionDraft['reason']) }}</p>
            <form method="post" action="{{ route('producer-applications.discard-draft', $application->id) }}">
                @csrf
                <button class="draft-dismiss" type="submit">Discard saved reason</button>
            </form>
        </div>
    @endif

    <section class="detail-section farm-section" aria-labelledby="farm-details-title">
        <div class="section-heading">
            <div>
                <h2 id="farm-details-title">Farm and collection details</h2>
            </div>
            <time class="submitted-date" datetime="{{ $application->submittedAt }}">Submitted {{ \Illuminate\Support\Carbon::parse($application->submittedAt)->format('j F Y') }}</time>
        </div>
        <div class="farm-facts">
            <div class="farm-fact">
                <h3>Location</h3>
                <p>{{ $application->application['city'] }}</p>
                <p>{{ $application->application['collectionAddress'] }}</p>
                <p class="coordinates">{{ number_format((float) $application->application['latitude'], 4) }}, {{ number_format((float) $application->application['longitude'], 4) }}</p>
            </div>
            <div class="farm-fact farm-description">
                <h3>About this farm</h3>
                <p>{{ $application->application['description'] }}</p>
            </div>
        </div>
    </section>

    @if ($application->rejectionReason)
        <section class="reason-note" aria-labelledby="rejection-reason-title">
            <h2 id="rejection-reason-title">Previous review reason</h2>
            <p>{{ $application->rejectionReason }}</p>
        </section>
    @endif

    <section class="detail-section review-section" aria-labelledby="review-title">
        <div class="section-heading">
            <div>
                <h2 id="review-title">Review for selling access</h2>
            </div>
            <span class="revision-label">Revision {{ $application->revision }}</span>
        </div>
        @if ($application->status === \App\DTOs\ProducerApplicationStatus::Pending)
            <p class="section-copy">Approval lets this producer publish and sell. Rejection sends the reason to the producer and allows them to correct and resubmit.</p>
            <div class="review-actions">
                <form method="post" action="{{ route('producer-applications.approve', $application->id) }}">
                    @csrf
                    <input type="hidden" name="revision" value="{{ $application->revision }}">
                    <button class="primary-button" type="submit">Approve application</button>
                </form>
                <form method="post" action="{{ route('producer-applications.reject', $application->id) }}" class="reason-form">
                    @csrf
                    <input type="hidden" name="revision" value="{{ $application->revision }}">
                    <div class="field">
                        <label for="rejection-reason">Reason for rejection</label>
                        <textarea id="rejection-reason" name="reason" rows="4" maxlength="500" required aria-describedby="rejection-help rejection-error">{{ old('reason', $decisionDraft && $decisionDraft['action'] === 'reject' ? $decisionDraft['reason'] : '') }}</textarea>
                        <span class="field-help" id="rejection-help">The producer can use this feedback to correct and resubmit. Maximum 500 characters.</span>
                        @error('reason') <span class="field-error" id="rejection-error">{{ $message }}</span> @enderror
                    </div>
                    <button class="quiet-button reject-button" type="submit">Reject application</button>
                </form>
            </div>
        @else
            <p class="section-copy">This application is {{ $application->status->value }}. Application decisions are separate from account standing.</p>
        @endif
    </section>

    <section class="detail-section standing-section" aria-labelledby="standing-title">
        <div class="section-heading">
            <div>
                <h2 id="standing-title">Producer selling access</h2>
            </div>
            <x-status-pill :tone="$application->status->value">{{ $application->status->label() }}</x-status-pill>
        </div>
        @if ($application->status === \App\DTOs\ProducerApplicationStatus::Approved)
            <p class="section-copy">Suspension hides normal-sale products and blocks new sales and auctions. Existing orders can still be fulfilled and active auctions continue.</p>
            <details class="confirmation-disclosure">
                <summary>Suspend this producer</summary>
                <div class="confirmation-content">
                    <p>Suspension blocks new sales and auction creation, and hides normal-sale products from buyers. Existing orders remain available and active auctions continue.</p>
                    <form method="post" action="{{ route('producer-applications.suspend', $application->id) }}" class="reason-form">
                        @csrf
                        <input type="hidden" name="revision" value="{{ $application->revision }}">
                        <div class="field">
                            <label for="suspension-reason">Reason for suspension</label>
                            <textarea id="suspension-reason" name="reason" rows="4" maxlength="500" required aria-describedby="suspension-help suspension-error">{{ old('reason', $decisionDraft && $decisionDraft['action'] === 'suspend' ? $decisionDraft['reason'] : '') }}</textarea>
                            <span class="field-help" id="suspension-help">This reason is shown to the producer. Maximum 500 characters.</span>
                            @error('reason') <span class="field-error" id="suspension-error">{{ $message }}</span> @enderror
                        </div>
                        <button class="danger-button" type="submit">Confirm suspension</button>
                    </form>
                </div>
            </details>
        @elseif ($application->status === \App\DTOs\ProducerApplicationStatus::Suspended)
            <p class="section-copy">The producer cannot sell or create auctions while suspended. Reinstatement returns the account to approved; it does not change product publication or moderation decisions.</p>
            @if ($application->suspensionReason)
                <p class="standing-reason"><strong>Current suspension reason:</strong> {{ $application->suspensionReason }}</p>
            @endif
            <details class="confirmation-disclosure">
                <summary>Reinstate this producer</summary>
                <div class="confirmation-content">
                    <p>Reinstatement returns the account to approved. Products become visible only if they are already published and not moderated or archived. Existing orders and auction records remain in place.</p>
                    <form method="post" action="{{ route('producer-applications.reinstate', $application->id) }}">
                        @csrf
                        <input type="hidden" name="revision" value="{{ $application->revision }}">
                        <button class="primary-button" type="submit">Confirm reinstatement</button>
                    </form>
                </div>
            </details>
        @else
            <p class="section-copy">Suspension is available only for approved producers. It does not change an application that is pending or rejected.</p>
        @endif
    </section>
</main>
@endsection
