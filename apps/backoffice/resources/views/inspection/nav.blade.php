<nav class="inspection-nav" aria-label="Inspection tools">
    <a href="{{ route('inspection.users') }}" @if (request()->routeIs('inspection.users', 'inspection.user')) aria-current="page" @endif>Users</a>
    <a href="{{ route('inspection.orders') }}" @if (request()->routeIs('inspection.orders', 'inspection.order')) aria-current="page" @endif>Orders</a>
    <a href="{{ route('inspection.auctions') }}" @if (request()->routeIs('inspection.auctions', 'inspection.auction')) aria-current="page" @endif>Auctions</a>
</nav>
