<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class BulkRecordRequest extends FormRequest
{
    /**
     * Estado que asigna cada acción. "delete" elimina en lugar de cambiar el estado.
     */
    public const ACTIONS = [
        'activate' => 'active',
        'archive' => 'archived',
        'pending' => 'pending',
        'delete' => null,
    ];

    public function rules(): array
    {
        return [
            'action' => ['required', Rule::in(array_keys(self::ACTIONS))],
            'all' => ['sometimes', 'boolean'],
            'ids' => ['required_unless:all,true', 'array', 'min:1', 'max:1000'],
            'ids.*' => ['integer', 'min:1', 'distinct'],
            'exceptIds' => ['sometimes', 'array', 'max:1000'],
            'exceptIds.*' => ['integer', 'min:1', 'distinct'],
            'filters' => ['sometimes', 'array:q,status,from,to'],
            ...RecordFilterRequest::filterRules('filters.'),
        ];
    }
}
