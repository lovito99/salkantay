<?php

namespace App\Http\Requests;

use App\Models\Record;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RecordFilterRequest extends FormRequest
{
    /**
     * Reglas de los filtros, compartidas con las acciones masivas.
     */
    public static function filterRules(string $prefix = ''): array
    {
        return [
            "{$prefix}q" => ['nullable', 'string', 'max:255'],
            "{$prefix}status" => ['nullable', Rule::in(Record::STATUSES)],
            "{$prefix}from" => ['nullable', 'date_format:Y-m-d'],
            "{$prefix}to" => ['nullable', 'date_format:Y-m-d', "after_or_equal:{$prefix}from"],
        ];
    }

    public function rules(): array
    {
        return [
            ...self::filterRules(),
            'page' => ['sometimes', 'integer', 'min:1'],
            'perPage' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ];
    }
}
