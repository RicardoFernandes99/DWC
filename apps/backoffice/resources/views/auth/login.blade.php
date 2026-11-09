@extends('layouts.app')

@section('title', 'Administrator sign in | DWC Backoffice')

@section('content')
<main class="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-16">
    @if (session('notice'))
        <x-alert>{{ session('notice') }}</x-alert>
    @endif
    @if ($errors->has('credentials'))
        <x-alert type="error">{{ $errors->first('credentials') }}</x-alert>
    @endif

    <x-ui.card>
        <x-ui.card-header>
            <p class="text-primary text-xs font-bold tracking-widest uppercase">Administrator access</p>
            <h1 id="login-title" class="text-3xl font-normal tracking-tight">Sign in to the backoffice</h1>
            <p class="text-muted-foreground text-sm">Use your administrator account to continue.</p>
        </x-ui.card-header>
        <x-ui.card-content>
            <form class="flex flex-col gap-5" method="post" action="{{ route('login.submit') }}" aria-labelledby="login-title">
                @csrf
                <x-ui.field>
                    <x-ui.label for="email">Email address</x-ui.label>
                    <x-ui.input id="email" name="email" type="email" autocomplete="username" inputmode="email" maxlength="254" :value="old('email')" required autofocus />
                    @error('email')<x-ui.field-error>{{ $message }}</x-ui.field-error>@enderror
                </x-ui.field>
                <x-ui.field>
                    <x-ui.label for="password">Password</x-ui.label>
                    <x-ui.input id="password" name="password" type="password" autocomplete="current-password" maxlength="72" required />
                    @error('password')<x-ui.field-error>{{ $message }}</x-ui.field-error>@enderror
                </x-ui.field>
                <x-ui.button type="submit">Sign in</x-ui.button>
            </form>
        </x-ui.card-content>
    </x-ui.card>
</main>
@endsection
