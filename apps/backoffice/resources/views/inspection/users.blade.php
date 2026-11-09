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
                <tr class="border-b">
                    <th scope="col" class="text-foreground h-10 px-4 text-start align-middle font-medium whitespace-nowrap">User</th>
                    <th scope="col" class="text-foreground h-10 px-2 text-start align-middle font-medium whitespace-nowrap">Role</th>
                    <th scope="col" class="text-foreground h-10 px-2 text-start align-middle font-medium whitespace-nowrap">Producer status</th>
                    <th scope="col" class="text-foreground h-10 px-2 text-start align-middle font-medium whitespace-nowrap">Buyer standing</th>
                    <th scope="col" class="text-foreground h-10 px-2 text-start align-middle font-medium whitespace-nowrap">Farm / city</th>
                    <th scope="col" class="text-foreground h-10 px-2 text-start align-middle font-medium whitespace-nowrap">Created</th>
                </tr>
            </x-ui.table-header>
            <x-ui.table-body>
                @foreach ($items as $user)
                    <tr class="hover:bg-muted/50 border-b transition-colors">
                        <td class="px-4 py-3 align-middle whitespace-nowrap">
                            <a class="font-semibold underline-offset-4 hover:underline" href="{{ route('inspection.user', $user['id']) }}">{{ $user['name'] }}</a>
                            <div class="text-muted-foreground text-xs">{{ $user['email'] }}</div>
                        </td>
                        <td class="p-2 align-middle whitespace-nowrap">{{ ucfirst($user['role']) }}</td>
                        <td class="p-2 align-middle whitespace-nowrap">{{ $user['producerStatus'] ? ucfirst($user['producerStatus']) : '—' }}</td>
                        <td class="p-2 align-middle whitespace-nowrap">{{ $user['role'] === 'buyer' ? ucfirst($user['buyerStatus'] ?? 'active') : '—' }}</td>
                        <td class="p-2 align-middle">{{ collect([$user['farmName'], $user['city']])->filter()->join(' · ') ?: '—' }}</td>
                        <td class="p-2 align-middle whitespace-nowrap"><time datetime="{{ $user['createdAt'] }}">{{ $user['createdAt'] ? \Carbon\Carbon::parse($user['createdAt'])->format('j M Y, H:i') : 'Unknown' }}</time></td>
                    </tr>
                @endforeach
            </x-ui.table-body>
        </x-ui.table>
    @endif
    @include('inspection.pagination')
</x-page>
@endsection
