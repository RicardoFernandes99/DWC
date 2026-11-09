@extends('layouts.app')

@section('title', 'Users | DWC Backoffice')

@section('content')
<x-page>
    <x-page-heading eyebrow="Administration / Inspection" title="Users" />
    @include('inspection.filter-errors')
    @include('inspection.filter-scope')
    <x-filters :action="route('inspection.users')">
        <x-filter-select label="Role" name="role" :options="['' => 'All roles', 'buyer' => 'Buyer', 'producer' => 'Producer', 'admin' => 'Admin']" />
        <x-filter-select label="Producer status" name="producerStatus" :options="['' => 'All statuses', 'pending' => 'Pending', 'approved' => 'Approved', 'rejected' => 'Rejected', 'suspended' => 'Suspended']" />
        <x-filter-select label="Page size" name="limit" :options="['20' => '20', '50' => '50']" />
    </x-filters>

    @if ($items === [])
        <x-empty-state title="No users match these filters" />
    @else
        <x-ui.table variant="card" aria-label="Users">
            <x-ui.table-header>
                <x-ui.table-row class="hover:bg-transparent">
                    <x-ui.table-head class="px-4">User</x-ui.table-head>
                    <x-ui.table-head>Role</x-ui.table-head>
                    <x-ui.table-head>Producer status</x-ui.table-head>
                    <x-ui.table-head>Buyer standing</x-ui.table-head>
                    <x-ui.table-head>Farm / city</x-ui.table-head>
                    <x-ui.table-head>Created</x-ui.table-head>
                </x-ui.table-row>
            </x-ui.table-header>
            <x-ui.table-body>
                @foreach ($items as $user)
                    <x-ui.table-row>
                        <x-ui.table-cell class="px-4 py-3">
                            <a class="font-semibold underline-offset-4 hover:underline" href="{{ route('inspection.user', $user['id']) }}">{{ $user['name'] }}</a>
                            <div class="text-muted-foreground text-xs">{{ $user['email'] }}</div>
                        </x-ui.table-cell>
                        <x-ui.table-cell>{{ ucfirst($user['role']) }}</x-ui.table-cell>
                        <x-ui.table-cell>{{ $user['producerStatus'] ? ucfirst($user['producerStatus']) : '—' }}</x-ui.table-cell>
                        <x-ui.table-cell>{{ $user['role'] === 'buyer' ? ucfirst($user['buyerStatus'] ?? 'active') : '—' }}</x-ui.table-cell>
                        <x-ui.table-cell class="whitespace-normal">{{ collect([$user['farmName'], $user['city']])->filter()->join(' · ') ?: '—' }}</x-ui.table-cell>
                        <x-ui.table-cell><time datetime="{{ $user['createdAt'] }}">{{ $user['createdAt'] ? \Carbon\Carbon::parse($user['createdAt'])->format('j M Y, H:i') : 'Unknown' }}</time></x-ui.table-cell>
                    </x-ui.table-row>
                @endforeach
            </x-ui.table-body>
        </x-ui.table>
    @endif
    @include('inspection.pagination')
</x-page>
@endsection
