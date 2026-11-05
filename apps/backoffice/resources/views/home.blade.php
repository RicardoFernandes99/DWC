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
            <p>Review producer applications, reported reviews and product listings.</p>
            <nav class="home-tools" aria-label="Administration tools">
                <a class="primary-button home-action" href="{{ route('producer-applications.index') }}">Producer applications</a>
                <a class="quiet-button home-action" href="{{ route('moderation.reviews') }}">Reported reviews</a>
                <a class="quiet-button home-action" href="{{ route('moderation.products') }}">Products</a>
            </nav>
        </div>
    </section>
</main>
@endsection
