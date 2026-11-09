@extends('layouts.app')

@section('title', 'User inspection | DWC Backoffice')

@section('content')
<x-page>
    <x-back-link :href="route('inspection.users')">← Users</x-back-link>
    <x-page-heading eyebrow="Administration / Inspection / Users" :title="$user['name']">
        {{ $user['email'] }}
        <x-slot:aside><x-status-pill :tone="$user['producerStatus'] ?? (($user['buyerStatus'] ?? 'active') === 'suspended' ? 'suspended' : 'neutral')">{{ ucfirst($user['role']) }}{{ $user['producerStatus'] ? ' · '.ucfirst($user['producerStatus']) : ($user['role'] === 'buyer' ? ' · '.ucfirst($user['buyerStatus'] ?? 'active') : '') }}</x-status-pill></x-slot:aside>
    </x-page-heading>
    @if (session('notice'))<x-alert>{{ session('notice') }}</x-alert>@endif
    @if (session('buyer_standing_error'))<x-alert type="error">{{ session('buyer_standing_error') }}</x-alert>@endif

    <x-section title="Account">
        <x-facts>
            <x-fact label="User ID" mono>{{ $user['id'] }}</x-fact>
            <x-fact label="Created">{{ $user['createdAt'] ? \Carbon\Carbon::parse($user['createdAt'])->format('j M Y, H:i') : 'Unknown' }}</x-fact>
            <x-fact label="Updated">{{ $user['updatedAt'] ? \Carbon\Carbon::parse($user['updatedAt'])->format('j M Y, H:i') : 'Unknown' }}</x-fact>
            <x-fact label="Farm">{{ $user['farmName'] ?? '—' }}</x-fact>
            <x-fact label="City">{{ $user['city'] ?? '—' }}</x-fact>
        </x-facts>
    </x-section>

    @if ($user['role'] === 'buyer')
        <x-section title="Buyer standing">
            <x-facts>
                <x-fact label="Current status">{{ ucfirst($user['buyerStatus'] ?? 'active') }}</x-fact>
                <x-fact label="Latest decision">Revision {{ $user['buyerDecisionRevision'] }}</x-fact>
                <x-fact label="Decision by">@if ($user['buyerDecisionBy'])<a class="underline underline-offset-4" href="{{ route('inspection.user', $user['buyerDecisionBy']) }}">{{ $user['buyerDecisionBy'] }}</a>@else — @endif</x-fact>
                <x-fact label="Decision time">{{ $user['buyerDecisionAt'] ? \Carbon\Carbon::parse($user['buyerDecisionAt'])->format('j M Y, H:i') : 'No decision recorded' }}</x-fact>
            </x-facts>
            @if ($user['buyerSuspensionReason'])<x-copy title="Suspension reason">{{ $user['buyerSuspensionReason'] }}</x-copy>@endif
            @if (($user['buyerStatus'] ?? 'active') === 'suspended')
                <p class="text-muted-foreground text-sm">This buyer can still sign in, read existing orders and results, manage saved cards, review completed orders and use notifications. Existing commitments and refunds continue normally.</p>
                <form method="post" action="{{ route('inspection.user.buyer-standing', [$user['id'], 'reinstate']) }}">
                    @csrf<input type="hidden" name="revision" value="{{ $user['buyerDecisionRevision'] }}">
                    <x-ui.button type="submit" variant="outline">Reinstate buyer</x-ui.button>
                </form>
            @else
                <p class="text-muted-foreground text-sm">Suspension blocks new purchases and bids, including open sessions. Existing accepted bids and paid orders continue.</p>
                <x-confirm summary="Suspend this buyer" :open="($buyerDecisionDraft && ($buyerDecisionDraft['action'] ?? null) === 'suspend') || $errors->has('reason')">
                    <x-reason-form
                        :action="route('inspection.user.buyer-standing', [$user['id'], 'suspend'])"
                        :revision="$user['buyerDecisionRevision']"
                        id="buyer-suspension-reason"
                        label="Reason"
                        help="Shown to the buyer. Maximum 500 characters."
                        submit="Suspend buyer"
                        :value="$buyerDecisionDraft['reason'] ?? ''" />
                    @if ($buyerDecisionDraft && ($buyerDecisionDraft['action'] ?? null) === 'suspend')
                        <form method="post" action="{{ route('inspection.user.buyer-standing.discard-draft', $user['id']) }}">
                            @csrf<x-ui.button type="submit" variant="outline" size="sm">Discard saved reason</x-ui.button>
                        </form>
                    @endif
                </x-confirm>
            @endif
        </x-section>
    @endif

    @if ($user['producerApplication'])
        <x-section title="Producer application">
            <x-facts>
                <x-fact label="Farm name">{{ $user['producerApplication']['farmName'] }}</x-fact>
                <x-fact label="City">{{ $user['producerApplication']['city'] }}</x-fact>
                <x-fact label="Submitted">{{ $user['producerApplication']['submittedAt'] ? \Carbon\Carbon::parse($user['producerApplication']['submittedAt'])->format('j M Y, H:i') : 'Unknown' }}</x-fact>
            </x-facts>
            <x-copy title="Description">{{ $user['producerApplication']['description'] }}</x-copy>
        </x-section>
    @endif

    @if ($user['producerDecisionRevision'] > 0 || $user['producerDecisionBy'] || $user['producerDecisionAt'] || $user['producerRejectionReason'] || $user['producerSuspensionReason'])
        <x-section title="Latest producer decision">
            <x-facts>
                <x-fact label="Revision">{{ $user['producerDecisionRevision'] }}</x-fact>
                <x-fact label="Decision by">@if ($user['producerDecisionBy'])<a class="underline underline-offset-4" href="{{ route('inspection.user', $user['producerDecisionBy']) }}">{{ $user['producerDecisionBy'] }}</a>@else — @endif</x-fact>
                <x-fact label="Decision time">{{ $user['producerDecisionAt'] ? \Carbon\Carbon::parse($user['producerDecisionAt'])->format('j M Y, H:i') : 'Unknown' }}</x-fact>
            </x-facts>
            @if ($user['producerRejectionReason'])<x-copy title="Rejection reason">{{ $user['producerRejectionReason'] }}</x-copy>@endif
            @if ($user['producerSuspensionReason'])<x-copy title="Suspension reason">{{ $user['producerSuspensionReason'] }}</x-copy>@endif
        </x-section>
    @endif
</x-page>
@endsection
