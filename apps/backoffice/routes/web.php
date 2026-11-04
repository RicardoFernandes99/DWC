<?php

use App\Http\Controllers\AdminHomeController;
use App\Http\Controllers\AdminProducerApplicationsController;
use App\Http\Controllers\BackofficeAuthController;
use App\Http\Middleware\PreserveProducerDecisionDraft;
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
Route::middleware([PreserveProducerDecisionDraft::class, 'current-admin'])->group(function (): void {
    Route::get('/producer-applications', [AdminProducerApplicationsController::class, 'index'])
        ->name('producer-applications.index')->block(45, 10);
    Route::get('/producer-applications/{id}', [AdminProducerApplicationsController::class, 'show'])
        ->where('id', '[a-fA-F0-9]{24}')
        ->name('producer-applications.show')->block(45, 10);
    Route::post('/producer-applications/{id}/discard-draft', [AdminProducerApplicationsController::class, 'discardDraft'])
        ->where('id', '[a-fA-F0-9]{24}')
        ->name('producer-applications.discard-draft')->block(45, 10);
    foreach (['approve', 'reject', 'suspend', 'reinstate'] as $action) {
        Route::post('/producer-applications/{id}/'.$action, [AdminProducerApplicationsController::class, 'decide'])
            ->where('id', '[a-fA-F0-9]{24}')
            ->defaults('action', $action)
            ->name('producer-applications.'.$action)->block(45, 10);
    }
});
