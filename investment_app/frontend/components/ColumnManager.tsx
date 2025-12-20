import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { fetchViewConfigs, saveViewConfig, updateViewConfig, deleteViewConfig, TableViewConfig } from '@/lib/api';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ColumnManagerProps {
    allColumns: { key: string; label: string }[];
    visibleColumns: string[];
    onUpdateColumns: (cols: string[]) => void;
    selectedViewId: string;
    onSelectView: (id: string) => void;
}

function SortableItem({ id, label, onRemove }: { id: string; label: string, onRemove: () => void }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="flex justify-between items-center p-2 mb-1 bg-gray-700 rounded border border-gray-600 cursor-move hover:bg-gray-600 select-none">
            <span className="truncate mr-2 text-gray-200">{label}</span>
            <button
                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                className="text-red-400 font-bold px-2 hover:bg-gray-800 rounded shrink-0"
                title="隠す"
            >
                ✕
            </button>
        </div>
    );
}

export default function ColumnManager({ allColumns, visibleColumns, onUpdateColumns, selectedViewId, onSelectView }: ColumnManagerProps) {
    const [views, setViews] = useState<TableViewConfig[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Manage local state in modal
    const [tempVisible, setTempVisible] = useState<string[]>([]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        loadViews();
    }, []);

    const loadViews = async () => {
        try {
            const data = await fetchViewConfigs();
            setViews(data);
        } catch (e) {
            console.error("Failed to load views", e);
        }
    };

    // Portal check
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);

    const handleViewChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        onSelectView(val);
        const id = parseInt(val);
        if (!id) return;

        const view = views.find(v => v.id === id);
        if (view) {
            try {
                const cols = JSON.parse(view.columns_json);
                onUpdateColumns(cols);
            } catch (err) {
                console.error("Invalid columns json", err);
            }
        }
    };

    const handleSaveView = async () => {
        const id = parseInt(selectedViewId);

        try {
            if (id) {
                // Update existing
                const updatedView = await updateViewConfig(id, { columns_json: JSON.stringify(visibleColumns) });
                setViews(views.map(v => v.id === id ? updatedView : v));
                alert("表示設定を更新しました");
            } else {
                // Create new
                const name = prompt("この表示設定の名前を入力してください:");
                if (!name) return;

                const newView = await saveViewConfig(name, JSON.stringify(visibleColumns));
                setViews([...views, newView]);
                onSelectView(newView.id.toString());
            }
        } catch (e) {
            alert("保存に失敗しました");
        }
    };

    const handleDeleteView = async (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();

        // alert(`Debug: Delete clicked. ID=${selectedViewId}`); // Debugging

        if (!selectedViewId) return;
        if (!confirm(`ビュー "${views.find(v => v.id === parseInt(selectedViewId))?.name}" を削除しますか？`)) return;

        try {
            await deleteViewConfig(parseInt(selectedViewId));
            // alert("API delete success"); // Debugging
            setViews(views.filter(v => v.id !== parseInt(selectedViewId)));
            onSelectView('');
            loadViews(); // Refresh list
        } catch (e) {
            console.error(e);
            alert("削除に失敗しました: " + String(e));
        }
    };

    // Modal logic
    const openModal = () => {
        setTempVisible(visibleColumns);
        setIsModalOpen(true);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (active.id !== over?.id) {
            setTempVisible((items) => {
                const oldIndex = items.indexOf(active.id as string);
                const newIndex = items.indexOf(over?.id as string);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const removeColumn = (key: string) => {
        setTempVisible(tempVisible.filter(k => k !== key));
    };

    const addColumn = (key: string) => {
        setTempVisible([...tempVisible, key]);
    };

    const applyColumns = () => {
        onUpdateColumns(tempVisible);
        setIsModalOpen(false);
    };

    const hiddenColumns = allColumns.filter(c => !tempVisible.includes(c.key));

    const modalContent = isModalOpen ? (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4" onClick={() => setIsModalOpen(false)}>
            <div className="bg-gray-800 p-6 rounded-xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col border border-gray-700 relative z-[10000]" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold mb-4">列のカスタマイズ</h3>

                <div className="flex md:flex-row flex-col gap-6 flex-1 overflow-hidden min-h-0">
                    {/* Active Columns (Draggable) */}
                    <div className="flex-1 flex flex-col min-h-0">
                        <h4 className="font-bold text-blue-400 mb-2 text-sm uppercase tracking-wide">表示する列 (ドラッグで並び替え)</h4>
                        <div className="flex-1 overflow-y-auto bg-gray-900/50 rounded-lg p-3 border border-gray-700">
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleDragEnd}
                            >
                                <SortableContext
                                    items={tempVisible}
                                    strategy={verticalListSortingStrategy}
                                >
                                    {tempVisible.map((colKey) => {
                                        const def = allColumns.find(c => c.key === colKey) || { key: colKey, label: colKey };
                                        return (
                                            <SortableItem key={colKey} id={colKey} label={def.label} onRemove={() => removeColumn(colKey)} />
                                        );
                                    })}
                                </SortableContext>
                            </DndContext>
                            {tempVisible.length === 0 && <div className="text-gray-500 text-center py-8 italic">表示する列がありません</div>}
                        </div>
                    </div>

                    {/* Hidden Columns (Click to add) */}
                    <div className="flex-1 flex flex-col min-h-0">
                        <h4 className="font-bold text-gray-400 mb-2 text-sm uppercase tracking-wide">非表示の列 (クリックで追加)</h4>
                        <div className="flex-1 overflow-y-auto bg-gray-900/50 rounded-lg p-3 border border-gray-700">
                            {hiddenColumns.map(col => (
                                <div
                                    key={col.key}
                                    onClick={() => addColumn(col.key)}
                                    className="p-2 mb-1 bg-gray-800 rounded border border-gray-700 hover:bg-gray-700 cursor-pointer flex justify-between items-center transition select-none group"
                                >
                                    <span className="text-gray-300 group-hover:text-white">{col.label}</span>
                                    <span className="text-green-500 font-bold mr-1 opacity-50 group-hover:opacity-100">+</span>
                                </div>
                            ))}
                            {hiddenColumns.length === 0 && <div className="text-gray-500 text-center py-8 italic">全ての列が表示されています</div>}
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-4 mt-6 pt-4 border-t border-gray-700">
                    <button
                        onClick={() => setIsModalOpen(false)}
                        className="px-4 py-2 rounded text-gray-300 hover:bg-gray-700 transition"
                    >
                        キャンセル
                    </button>
                    <button
                        onClick={applyColumns}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold shadow-lg transition"
                    >
                        適用
                    </button>
                </div>
            </div>
        </div>
    ) : null;

    return (
        <div className="flex items-center gap-2 text-sm z-10 relative">
            <span className="font-bold text-gray-400">列:</span>
            <button
                onClick={openModal}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 font-bold border border-gray-600 transition"
            >
                編集 ({visibleColumns.length})
            </button>
            <select
                className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-gray-300 focus:outline-none max-w-[150px]"
                value={selectedViewId}
                onChange={handleViewChange}
            >
                <option value="">(Custom)</option>
                {views.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                ))}
            </select>
            {selectedViewId && (
                <button title="Delete View" onClick={handleDeleteView} className="text-red-400 hover:text-red-300">✕</button>
            )}
            <button title="Save View" onClick={handleSaveView} className="text-blue-400 hover:text-blue-300">💾</button>

            {mounted && createPortal(modalContent, document.body)}
        </div>
    );
}
