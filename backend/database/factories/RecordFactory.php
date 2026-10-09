<?php

namespace Database\Factories;

use App\Models\Record;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Record>
 */
class RecordFactory extends Factory
{
    private const TITLES = [
        'Plan de trabajo',
        'Inventario de recursos',
        'Revisión de documentos',
        'Seguimiento de solicitudes',
        'Reporte de actividades',
        'Coordinación del equipo',
        'Registro de proveedores',
        'Control de entregas',
    ];

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'title' => fake()->randomElement(self::TITLES).' '.fake()->unique()->numberBetween(100, 999),
            'description' => 'Información de ejemplo para explorar la gestión de registros.',
            'status' => fake()->randomElement(Record::STATUSES),
        ];
    }
}
