<?php

namespace Database\Seeders;

use App\Models\Record;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Usuario de demostración con registros para probar la interfaz.
 * Acceso: demo@salkantay.local / Salkantay2026!
 */
class DemoSeeder extends Seeder
{
    public function run(): void
    {
        $user = User::firstOrCreate(
            ['email' => 'demo@salkantay.local'],
            ['name' => 'Usuario Demo', 'password' => 'Salkantay2026!'],
        );

        if ($user->records()->exists()) {
            return;
        }

        Record::factory()->count(24)->for($user)->create();
    }
}
