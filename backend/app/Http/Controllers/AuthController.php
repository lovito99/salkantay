<?php

namespace App\Http\Controllers;

use App\Http\Requests\LoginRequest;
use App\Http\Resources\UserResource;
use Illuminate\Http\JsonResponse;

class AuthController extends Controller
{
    /**
     * POST /api/login: valida las credenciales y entrega un JWT.
     */
    public function login(LoginRequest $request): JsonResponse
    {
        $token = auth('api')->attempt($request->validated());

        if (! $token) {
            return response()->json(['message' => 'Correo o contraseña incorrectos.'], 401);
        }

        return response()->json([
            'token' => $token,
            'tokenType' => 'bearer',
            'expiresIn' => auth('api')->factory()->getTTL() * 60,
            'user' => UserResource::make(auth('api')->user()),
        ]);
    }

    /**
     * GET /api/me: devuelve el usuario dueño del JWT.
     */
    public function me(): JsonResponse
    {
        return response()->json(['user' => UserResource::make(auth('api')->user())]);
    }

    /**
     * POST /api/logout: invalida el JWT actual (lista negra).
     */
    public function logout(): JsonResponse
    {
        auth('api')->logout();

        return response()->json(['message' => 'Sesión cerrada.']);
    }
}
