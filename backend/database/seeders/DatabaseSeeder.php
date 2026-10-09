<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * php artisan db:seed
     */
    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            $this->command?->warn('Los datos de demostración solo se crean en local o testing.');

            return;
        }

        $this->call([
            DemoSeeder::class,
            PlaywrightSeeder::class,
        ]);
    }
}
