@extends('layouts.app')

@section('title', 'Administration | DWC Backoffice')

@section('header-action')
    <form method="post" action="{{ route('logout') }}">
        @csrf
        <button class="quiet-button" type="submit">Sign out</button>
    </form>
@endsection

@section('content')
<main class="workspace">
    <div class="workspace-heading">
        <div>
            <p class="eyebrow">Administration</p>
            <h1>Backoffice</h1>
        </div>
        <div class="identity" aria-label="Signed-in administrator">
            <span class="identity-name">{{ session('admin_identity.name') }}</span>
            <span class="role-label">Administrator</span>
        </div>
    </div>

    <section class="empty-state" aria-labelledby="empty-title">
        <div>
            <h2 id="empty-title">Marketplace review</h2>
            <p>Review applications and content, inspect users, orders and auctions, and check service health.</p>
            <nav class="home-tools" aria-label="Administration tools">
                <a class="primary-button home-action" href="{{ route('producer-applications.index') }}">Producer applications</a>
                <a class="quiet-button home-action" href="{{ route('moderation.reviews') }}">Reported reviews</a>
                <a class="quiet-button home-action" href="{{ route('moderation.products') }}">Products</a>
                <a class="quiet-button home-action" href="{{ route('inspection.users') }}">Users</a>
                <a class="quiet-button home-action" href="{{ route('inspection.orders') }}">Orders</a>
                <a class="quiet-button home-action" href="{{ route('inspection.auctions') }}">Auctions</a>
                <a class="quiet-button home-action" href="{{ route('inspection.health') }}">Service health</a>
            </nav>
        </div>
    </section>
</main>
@endsection
