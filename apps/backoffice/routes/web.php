<?php

use App\Http\Controllers\AdminHomeController;
use App\Http\Controllers\AdminInspectionController;
use App\Http\Controllers\AdminModerationController;
use App\Http\Controllers\AdminProducerApplicationsController;
use App\Http\Controllers\BackofficeAuthController;
use App\Http\Middleware\PreserveModerationDraft;
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
Route::middleware([PreserveModerationDraft::class, 'current-admin'])->group(function (): void {
    Route::get('/moderation/products', [AdminModerationController::class, 'products'])
        ->name('moderation.products')->block(45, 10);
    Route::get('/moderation/products/{id}', [AdminModerationController::class, 'product'])
        ->where('id', '[a-fA-F0-9]{24}')
        ->name('moderation.product')->block(45, 10);
    Route::get('/moderation/reviews', [AdminModerationController::class, 'reviews'])
        ->name('moderation.reviews')->block(45, 10);
    Route::get('/moderation/reviews/{id}', [AdminModerationController::class, 'review'])
        ->where('id', '[a-fA-F0-9]{24}')
        ->name('moderation.review')->block(45, 10);
    Route::post('/moderation/{kind}/{id}/hide', [AdminModerationController::class, 'hide'])
        ->where(['kind' => 'product|review', 'id' => '[a-fA-F0-9]{24}'])
        ->name('moderation.hide')->block(45, 10);
});
Route::middleware('current-admin')->group(function (): void {
    Route::get('/users', [AdminInspectionController::class, 'users'])->name('inspection.users')->block(45, 10);
    Route::get('/users/{id}', [AdminInspectionController::class, 'user'])
        ->where('id', '[a-fA-F0-9]{24}')->name('inspection.user')->block(45, 10);
    Route::get('/orders', [AdminInspectionController::class, 'orders'])->name('inspection.orders')->block(45, 10);
    Route::get('/orders/{id}', [AdminInspectionController::class, 'order'])
        ->where('id', '[a-fA-F0-9]{24}')->name('inspection.order')->block(45, 10);
    Route::get('/auctions', [AdminInspectionController::class, 'auctions'])->name('inspection.auctions')->block(45, 10);
    Route::get('/auctions/{id}', [AdminInspectionController::class, 'auction'])
        ->where('id', '[a-fA-F0-9]{24}')->name('inspection.auction')->block(45, 10);
    Route::get('/health', [AdminInspectionController::class, 'health'])->name('inspection.health')->block(45, 10);
});
