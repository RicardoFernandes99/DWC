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
            <h2 id="empty-title">Producer applications</h2>
            <p>Review submitted farm details, decide who can sell, and manage producer account standing.</p>
            <a class="primary-button home-action" href="{{ route('producer-applications.index') }}">Review applications</a>
        </div>
    </section>
</main>
@endsection
