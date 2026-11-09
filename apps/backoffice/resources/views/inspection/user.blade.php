@extends('layouts.app')

@section('title', 'User inspection | DWC Backoffice')

@section('content')
<main class="workspace inspection-workspace">
    <p class="eyebrow">Administration / Inspection / Users</p>
    <x-back-link :href="route('inspection.users')">Back to users</x-back-link>
    <div class="inspection-heading"><div><h1>{{ $user['name'] }}</h1><p class="page-intro">{{ $user['email'] }}</p></div><x-status-pill :tone="$user['producerStatus'] ?? (($user['buyerStatus'] ?? 'active') === 'suspended' ? 'suspended' : 'neutral')">{{ ucfirst($user['role']) }}{{ $user['producerStatus'] ? ' · '.ucfirst($user['producerStatus']) : ($user['role'] === 'buyer' ? ' · '.ucfirst($user['buyerStatus'] ?? 'active') : '') }}</x-status-pill></div>
    @if (session('notice'))<x-alert>{{ session('notice') }}</x-alert>@endif
    @if (session('buyer_standing_error'))<x-alert type="error">{{ session('buyer_standing_error') }}</x-alert>@endif
    @include('inspection.nav')
    <section class="inspection-section">
        <h2>Account</h2>
        <dl class="inspection-facts">
            <x-fact label="User ID" mono>{{ $user['id'] }}</x-fact>
            <x-fact label="Created">{{ $user['createdAt'] ? \Carbon\Carbon::parse($user['createdAt'])->format('j M Y, H:i') : 'Unknown' }}</x-fact>
            <x-fact label="Updated">{{ $user['updatedAt'] ? \Carbon\Carbon::parse($user['updatedAt'])->format('j M Y, H:i') : 'Unknown' }}</x-fact>
            <x-fact label="Farm">{{ $user['farmName'] ?? '—' }}</x-fact>
            <x-fact label="City">{{ $user['city'] ?? '—' }}</x-fact>
        </dl>
    </section>
    @if ($user['role'] === 'buyer')
        <section class="inspection-section" aria-labelledby="buyer-standing-heading">
            <h2 id="buyer-standing-heading">Buyer standing</h2>
            <dl class="inspection-facts">
                <x-fact label="Current status">{{ ucfirst($user['buyerStatus'] ?? 'active') }}</x-fact>
                <x-fact label="Latest decision">Revision {{ $user['buyerDecisionRevision'] }}</x-fact>
                <x-fact label="Decision by">@if ($user['buyerDecisionBy'])<a href="{{ route('inspection.user', $user['buyerDecisionBy']) }}">{{ $user['buyerDecisionBy'] }}</a>@else — @endif</x-fact>
                <x-fact label="Decision time">{{ $user['buyerDecisionAt'] ? \Carbon\Carbon::parse($user['buyerDecisionAt'])->format('j M Y, H:i') : 'No decision recorded' }}</x-fact>
            </dl>
            @if ($user['buyerSuspensionReason'])<div class="inspection-copy"><h3>Suspension reason</h3><p>{{ $user['buyerSuspensionReason'] }}</p></div>@endif
            @if (($user['buyerStatus'] ?? 'active') === 'suspended')
                <p class="section-copy">This buyer can still sign in, read existing orders and results, manage saved cards, review completed orders and use notifications. Existing commitments and refunds continue normally.</p>
                <form method="post" action="{{ route('inspection.user.buyer-standing', [$user['id'], 'reinstate']) }}">
                    @csrf<input type="hidden" name="revision" value="{{ $user['buyerDecisionRevision'] }}">
                    <button class="quiet-button" type="submit">Reinstate buyer</button>
                </form>
            @else
                <p class="section-copy">Suspension blocks new purchases and bids, including open sessions. Existing accepted bids and paid orders continue.</p>
                <details class="decision-disclosure" @if ($buyerDecisionDraft && ($buyerDecisionDraft['action'] ?? null) === 'suspend') open @endif @if ($errors->has('reason')) open @endif>
                    <summary>Suspend this buyer</summary>
                    <form method="post" action="{{ route('inspection.user.buyer-standing', [$user['id'], 'suspend']) }}" class="reason-form">
                        @csrf<input type="hidden" name="revision" value="{{ $user['buyerDecisionRevision'] }}">
                        <label for="buyer-suspension-reason">Reason</label>
                        <textarea id="buyer-suspension-reason" name="reason" required minlength="1" maxlength="500" rows="4" aria-describedby="buyer-suspension-help @error('reason') buyer-suspension-error @enderror" @error('reason') aria-invalid="true" @enderror>{{ old('reason', $buyerDecisionDraft['reason'] ?? '') }}</textarea>
                        <span class="field-help" id="buyer-suspension-help">Shown to the buyer. Maximum 500 characters.</span>
                        @error('reason')<p class="field-error" id="buyer-suspension-error">{{ $message }}</p>@enderror
                        <button class="danger-button" type="submit">Suspend buyer</button>
                    </form>
                    @if ($buyerDecisionDraft && ($buyerDecisionDraft['action'] ?? null) === 'suspend')
                        <form method="post" action="{{ route('inspection.user.buyer-standing.discard-draft', $user['id']) }}" class="mt-3">
                            @csrf<button class="quiet-button" type="submit">Discard saved reason</button>
                        </form>
                    @endif
                </details>
            @endif
        </section>
    @endif
    @if ($user['producerApplication'])
        <section class="inspection-section">
            <h2>Producer application</h2>
            <dl class="inspection-facts">
                <x-fact label="Farm name">{{ $user['producerApplication']['farmName'] }}</x-fact>
                <x-fact label="City">{{ $user['producerApplication']['city'] }}</x-fact>
                <x-fact label="Submitted">{{ $user['producerApplication']['submittedAt'] ? \Carbon\Carbon::parse($user['producerApplication']['submittedAt'])->format('j M Y, H:i') : 'Unknown' }}</x-fact>
            </dl>
            <div class="inspection-copy"><h3>Description</h3><p>{{ $user['producerApplication']['description'] }}</p></div>
        </section>
    @endif
    @if ($user['producerDecisionRevision'] > 0 || $user['producerDecisionBy'] || $user['producerDecisionAt'] || $user['producerRejectionReason'] || $user['producerSuspensionReason'])
        <x-section title="Latest producer decision">
            <dl class="inspection-facts"><x-fact label="Revision">{{ $user['producerDecisionRevision'] }}</x-fact><x-fact label="Decision by">@if ($user['producerDecisionBy'])<a href="{{ route('inspection.user', $user['producerDecisionBy']) }}">{{ $user['producerDecisionBy'] }}</a>@else — @endif</x-fact><x-fact label="Decision time">{{ $user['producerDecisionAt'] ? \Carbon\Carbon::parse($user['producerDecisionAt'])->format('j M Y, H:i') : 'Unknown' }}</x-fact></dl>
            @if ($user['producerRejectionReason'])<div class="inspection-copy"><h3>Rejection reason</h3><p>{{ $user['producerRejectionReason'] }}</p></div>@endif
            @if ($user['producerSuspensionReason'])<div class="inspection-copy"><h3>Suspension reason</h3><p>{{ $user['producerSuspensionReason'] }}</p></div>@endif</x-section>
    @endif
</main>
@endsection
