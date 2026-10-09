<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use RuntimeException;

/**
 * Usuarios que usan las pruebas de Playwright (backend/tests/playwright).
 */
class PlaywrightSeeder extends Seeder
{
    public const PASSWORD = 'Playwright2026!';

    public const EMAILS = [
        'playwright@salkantay.local',
        'other@salkantay.local',
    ];

    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new RuntimeException('Los usuarios de prueba solo se crean en local o testing.');
        }

        foreach (self::EMAILS as $email) {
            User::firstOrCreate(
                ['email' => $email],
                ['name' => 'Usuario de pruebas', 'password' => self::PASSWORD],
            );
        }
    }
}
