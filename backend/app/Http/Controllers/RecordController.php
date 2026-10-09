<?php

namespace App\Http\Controllers;

use App\Http\Requests\BulkRecordRequest;
use App\Http\Requests\RecordFilterRequest;
use App\Http\Requests\RecordRequest;
use App\Http\Resources\RecordResource;
use App\Models\Record;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class RecordController extends Controller
{
    /**
     * GET /api/records: listado filtrado y paginado.
     */
    public function index(RecordFilterRequest $request): JsonResponse
    {
        $filters = $request->validated();

        $page = $this->records()
            ->filter($filters)
            ->latest('id')
            ->paginate($filters['perPage'] ?? 10);

        return response()->json([
            'data' => RecordResource::collection($page->items()),
            'meta' => [
                'page' => $page->currentPage(),
                'lastPage' => $page->lastPage(),
                'perPage' => $page->perPage(),
                'total' => $page->total(),
                'from' => $page->firstItem(),
                'to' => $page->lastItem(),
            ],
        ]);
    }

    /**
     * POST /api/records
     */
    public function store(RecordRequest $request): JsonResponse
    {
        $record = auth('api')->user()->records()->create($request->validated());

        return RecordResource::make($record)->response()->setStatusCode(201);
    }

    /**
     * GET /api/records/{id}
     */
    public function show(int $id): RecordResource
    {
        return RecordResource::make($this->findRecord($id));
    }

    /**
     * PUT /api/records/{id}
     */
    public function update(RecordRequest $request, int $id): RecordResource
    {
        $record = $this->findRecord($id);
        $record->update($request->validated());

        return RecordResource::make($record);
    }

    /**
     * DELETE /api/records/{id}
     */
    public function destroy(int $id): Response
    {
        $this->findRecord($id)->delete();

        return response()->noContent();
    }

    /**
     * POST /api/records/bulk: aplica una acción a varios registros.
     *
     * - Selección manual: "ids" con los registros elegidos.
     * - Seleccionar todos: "all" = true, con los "filters" activos
     *   y "exceptIds" con los registros desmarcados.
     */
    public function bulk(BulkRecordRequest $request): JsonResponse
    {
        $data = $request->validated();
        $query = $this->records()->filter($data['filters'] ?? []);

        if ($data['all'] ?? false) {
            $query->whereNotIn('id', $data['exceptIds'] ?? []);
        } else {
            $query->whereIn('id', $data['ids']);

            // Si algún id no existe o es de otro usuario, se rechaza toda la operación.
            abort_unless((clone $query)->count() === count($data['ids']), 404, 'Selección inválida.');
        }

        $status = BulkRecordRequest::ACTIONS[$data['action']];

        $affected = DB::transaction(fn () => $status === null
            ? $query->delete()
            : $query->update(['status' => $status, 'updated_at' => now()]));

        return response()->json(['message' => 'Acción completada.', 'affected' => $affected]);
    }

    /**
     * Registros del usuario autenticado. Nunca se consultan registros ajenos.
     */
    private function records(): Builder
    {
        return auth('api')->user()->records()->getQuery();
    }

    private function findRecord(int $id): Record
    {
        return $this->records()->findOrFail($id);
    }
}
