<?php

use App\Http\Controllers\AdminHomeController;
use App\Http\Controllers\BackofficeAuthController;
use Illuminate\Support\Facades\Route;

Route::get('/login', [BackofficeAuthController::class, 'showLogin'])
    ->name('login')
    ->block(45, 10);
Route::post('/login', [BackofficeAuthController::class, 'login'])
    ->name('login.submit')
    ->block(45, 10);
Route::post('/logout', [BackofficeAuthController::class, 'logout'])
    ->name('logout')
    ->block(45, 10);
Route::get('/', AdminHomeController::class)
    ->middleware('current-admin')
    ->name('home')
    ->block(45, 10);
