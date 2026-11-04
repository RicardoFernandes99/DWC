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
            <h2 id="empty-title">Your workspace is ready</h2>
            <p>Administrative tools will appear here as they are added to the backoffice.</p>
        </div>
    </section>
</main>
@endsection
