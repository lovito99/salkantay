<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\RecordController;
use Illuminate\Support\Facades\Route;

// 1. Autenticación
Route::post('login', [AuthController::class, 'login'])->middleware('throttle:10,1');

Route::middleware(['auth:api', 'throttle:120,1'])->group(function () {
    Route::get('me', [AuthController::class, 'me']);
    Route::post('logout', [AuthController::class, 'logout']);

    // 3. Acciones masivas (antes del resource para que "bulk" no se tome como id)
    Route::post('records/bulk', [RecordController::class, 'bulk']);

    // 2. Gestión de registros (CRUD)
    Route::apiResource('records', RecordController::class)
        ->parameters(['records' => 'id'])
        ->whereNumber('id');
});
