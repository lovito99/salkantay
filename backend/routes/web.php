<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response()->json(['name' => 'Salkantay API', 'frontend' => 'Angular 17', 'health' => '/up']);
});
