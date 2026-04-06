"use client";

import { useState, useRef } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Block } from "@/types/block";
import { resizeImage } from "@/lib/crop-photo";

// ─────────────────────────────────────────────
// Grip handle — colored left zone
// ─────────────────────────────────────────────
function GripZone(props: object) {
  return (
    <button
      {...props}
      className="touch-none flex-shrink-0 flex flex-col items-center justify-center gap-[4px] self-stretch px-2.5 rounded-l-2xl"
      style={{
        background: "#E8E3DC",
        minWidth: 36,
        WebkitUserSelect: "none",
        userSelect: "none",
        cursor: "grab",
        touchAction: "none",
      }}
    >
      {[0, 1, 2].map((row) => (
        <span key={row} className="flex gap-[4px]">
          {[0, 1].map((col) => (
            <span key={col} className="block rounded-full" style={{ width: 4, height: 4, background: "#9B9590" }} />
          ))}
        </span>
      ))}
    </button>
  );
}

// ─────────────────────────────────────────────
// Mini grip for ingredient items
// ─────────────────────────────────────────────
function MiniGrip(props: object) {
  return (
    <button
      {...props}
      className="touch-none flex-shrink-0 flex flex-col items-center justify-center gap-[3px] px-2 py-2 self-stretch"
      style={{ cursor: "grab", WebkitUserSelect: "none", userSelect: "none", touchAction: "none" }}
    >
      {[0, 1, 2].map((row) => (
        <span key={row} className="flex gap-[3px]">
          {[0, 1].map((col) => (
            <span key={col} className="block rounded-full" style={{ width: 3, height: 3, background: "#C5BFB8" }} />
          ))}
        </span>
      ))}
    </button>
  );
}

// ─────────────────────────────────────────────
// Step number badge
// ─────────────────────────────────────────────
function StepBadge({ num }: { num: number | null }) {
  return (
    <div
      className="flex-shrink-0 flex items-center justify-center rounded-full font-black"
      style={{ width: 34, height: 34, minWidth: 34, background: "#C96A2E", color: "#FFFFFF", fontSize: 15 }}
    >
      {num ?? "·"}
    </div>
  );
}

// ─────────────────────────────────────────────
// Sortable ingredient item
// ─────────────────────────────────────────────
function SortableIngredientItem({
  id,
  value,
  onChange,
  onRemove,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      className="flex gap-1 items-center"
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, touchAction: "manipulation" }}
    >
      <MiniGrip {...attributes} {...listeners} />
      <textarea
        value={value}
        ref={(el) => {
          if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }
        }}
        onChange={(e) => {
          e.target.style.height = "auto";
          e.target.style.height = e.target.scrollHeight + "px";
          onChange(e.target.value);
        }}
        rows={1}
        className="flex-1 outline-none py-1.5 bg-transparent leading-snug"
        style={{ color: "#1A1712", borderBottom: "1px solid #E8E4DF", fontSize: 16, resize: "none", overflow: "hidden", wordBreak: "break-word" }}
        placeholder="材料（分量）"
      />
      <button
        onClick={onRemove}
        className="w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0"
        style={{ background: "#F0EDE8", color: "#9B9590" }}
      >✕</button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Sortable block wrapper
// ─────────────────────────────────────────────
function SortableBlock({
  block,
  stepNumber,
  onUpdate,
  onDelete,
}: {
  block: Block;
  stepNumber: number | null;
  onUpdate: (updated: Block) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id });

  return (
    <div
      ref={setNodeRef}
      className="touch-manipulation"
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.45 : 1, zIndex: isDragging ? 50 : undefined }}
    >
      <BlockItem
        block={block}
        stepNumber={stepNumber}
        onUpdate={onUpdate}
        onDelete={onDelete}
        gripProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────
// Block item
// ─────────────────────────────────────────────
function BlockItem({
  block,
  stepNumber,
  onUpdate,
  onDelete,
  gripProps,
}: {
  block: Block;
  stepNumber: number | null;
  onUpdate: (updated: Block) => void;
  onDelete: () => void;
  gripProps: object;
}) {
  const [editing, setEditing] = useState(false);

  // ── Photo ──
  if (block.type === "photo") {
    const photoBlock = block;
    const rotateImage = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.height;
        canvas.height = img.width;
        const ctx = canvas.getContext("2d")!;
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        onUpdate({ id: photoBlock.id, type: "photo", base64: canvas.toDataURL("image/jpeg", 0.72) });
      };
      img.src = photoBlock.base64;
    };

    return (
      <div
        className="flex overflow-hidden rounded-2xl items-center"
        style={{ background: "#FFFFFF", boxShadow: "0 1px 4px rgba(26,23,18,0.08)", borderLeft: "3px solid #D5CFC8", height: 72 }}
      >
        <GripZone {...gripProps} />
        <div className="flex items-center gap-2.5 flex-1 px-3 min-w-0">
          <div className="flex-shrink-0 rounded-lg overflow-hidden flex items-center justify-center" style={{ width: 72, height: 54, background: "#F0EDE8" }}>
            <img src={block.base64} alt="写真" className="max-w-full max-h-full object-contain" />
          </div>
          <span className="text-xs font-medium truncate" style={{ color: "#9B9590" }}>写真</span>
        </div>
        <div className="flex items-center gap-1.5 pr-2">
          <button onClick={rotateImage} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "#F0EDE8", color: "#9B9590" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6"/><path d="M21.34 15.57a10 10 0 1 1-.57-8.38"/>
            </svg>
          </button>
          <button onClick={onDelete} className="w-7 h-7 rounded-full flex items-center justify-center text-xs" style={{ background: "#F0EDE8", color: "#9B9590" }}>✕</button>
        </div>
      </div>
    );
  }

  // ── Ingredients ──
  if (block.type === "ingredients") {
    return <IngredientsBlock block={block} onUpdate={onUpdate} />;
  }

  // ── Memo ──
  if (block.type === "memo") {
    return (
      <div
        className="flex overflow-hidden rounded-2xl"
        style={{ background: "#FFFBEB", boxShadow: "0 1px 4px rgba(26,23,18,0.08)", borderLeft: "3px solid #FCD34D" }}
      >
        <GripZone {...gripProps} />
        <div className="flex-1 py-3 px-3 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: "#92400E" }}>メモ</p>
          {editing ? (
            <textarea
              autoFocus
              value={block.text}
              ref={(el) => {
                if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }
              }}
              onChange={(e) => {
                e.target.style.height = "auto";
                e.target.style.height = e.target.scrollHeight + "px";
                onUpdate({ ...block, text: e.target.value });
              }}
              onBlur={() => setEditing(false)}
              className="w-full outline-none bg-transparent leading-relaxed"
              style={{ color: "#92400E", fontSize: 15, resize: "none", overflow: "hidden" }}
              placeholder="メモを入力…"
            />
          ) : (
            <button onClick={() => setEditing(true)} className="w-full text-left">
              <p style={{ color: block.text ? "#92400E" : "#D97706", fontSize: 15, lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {block.text || "タップして入力…"}
              </p>
            </button>
          )}
        </div>
        <div className="flex items-start pt-3 pr-2">
          <button onClick={onDelete} className="w-7 h-7 rounded-full flex items-center justify-center text-xs" style={{ background: "#FDE68A", color: "#92400E" }}>✕</button>
        </div>
      </div>
    );
  }

  // ── Hero (エディタには渡さないが型安全のため) ──
  if (block.type === "hero") return null;

  // ── Step ──
  return (
    <div
      className="flex overflow-hidden rounded-2xl"
      style={{ background: "#FFFFFF", boxShadow: "0 1px 4px rgba(26,23,18,0.08)", borderLeft: "3px solid #C96A2E" }}
    >
      <GripZone {...gripProps} />
      <div className="flex-1 py-3 px-2 flex gap-2 items-start min-w-0">
        <StepBadge num={stepNumber} />
        <div className="flex-1 min-w-0">
          {editing ? (
            <textarea
              autoFocus
              value={block.text}
              ref={(el) => {
                if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }
              }}
              onChange={(e) => {
                e.target.style.height = "auto";
                e.target.style.height = e.target.scrollHeight + "px";
                onUpdate({ ...block, text: e.target.value });
              }}
              onBlur={() => setEditing(false)}
              className="w-full leading-relaxed outline-none bg-transparent"
              style={{ color: "#1A1712", borderBottom: "1.5px solid #C96A2E", fontSize: 16, resize: "none", overflow: "hidden" }}
            />
          ) : (
            <button onClick={() => setEditing(true)} className="w-full text-left">
              <p style={{ color: block.text ? "#1A1712" : "#9B9590", fontSize: 15, lineHeight: 1.6 }}>
                {block.text || "タップして入力…"}
              </p>
            </button>
          )}
        </div>
      </div>
      <div className="flex items-start pt-3 pr-2">
        <button onClick={onDelete} className="w-7 h-7 rounded-full flex items-center justify-center text-xs" style={{ background: "#F0EDE8", color: "#9B9590" }}>✕</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Ingredients block — fixed position, items are sortable
// ─────────────────────────────────────────────
function IngredientsBlock({
  block,
  onUpdate,
}: {
  block: Extract<Block, { type: "ingredients" }>;
  onUpdate: (updated: Block) => void;
}) {
  const [itemIds, setItemIds] = useState<string[]>(() =>
    block.items.map(() => crypto.randomUUID())
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  function handleItemDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = itemIds.indexOf(active.id as string);
      const newIdx = itemIds.indexOf(over.id as string);
      setItemIds((prev) => arrayMove(prev, oldIdx, newIdx));
      onUpdate({ ...block, items: arrayMove(block.items, oldIdx, newIdx) });
    }
  }

  function updateItem(i: number, value: string) {
    const items = [...block.items];
    items[i] = value;
    onUpdate({ ...block, items });
  }

  function removeItem(i: number) {
    setItemIds((prev) => prev.filter((_, idx) => idx !== i));
    onUpdate({ ...block, items: block.items.filter((_, idx) => idx !== i) });
  }

  function addItem() {
    setItemIds((prev) => [...prev, crypto.randomUUID()]);
    onUpdate({ ...block, items: [...block.items, ""] });
  }

  return (
    <div
      className="overflow-hidden rounded-2xl"
      style={{ background: "#FFFFFF", boxShadow: "0 1px 4px rgba(26,23,18,0.08)", border: "1px solid #E8E4DF" }}
    >
      <div className="flex items-center px-4 py-2.5" style={{ borderBottom: "1px solid #F0EDE8" }}>
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#9B9590" }}>材料</p>
      </div>

      <div className="px-3 pb-4">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleItemDragEnd}>
          <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            <div className="mt-2 space-y-1">
              {block.items.map((item, i) => (
                <SortableIngredientItem
                  key={itemIds[i]}
                  id={itemIds[i]}
                  value={item}
                  onChange={(v) => updateItem(i, v)}
                  onRemove={() => removeItem(i)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <button onClick={addItem} className="mt-3 text-sm font-semibold" style={{ color: "#C96A2E" }}>
          ＋ 材料を追加
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main BlockEditor
// ─────────────────────────────────────────────
export default function BlockEditor({
  blocks,
  onChange,
}: {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = blocks.findIndex((b) => b.id === active.id);
      const newIdx = blocks.findIndex((b) => b.id === over.id);
      onChange(arrayMove(blocks, oldIdx, newIdx));
    }
  }

  async function handlePhotoFiles(files: FileList) {
    setUploading(true);
    try {
      const newBlocks: Block[] = [];
      for (const file of Array.from(files)) {
        const raw = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const base64 = await resizeImage(raw, 1200);
        newBlocks.push({ id: crypto.randomUUID(), type: "photo", base64 });
      }
      onChange([...blocks, ...newBlocks]);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  let stepCount = 0;
  const stepNumbers = blocks.map((b) => (b.type === "step" ? ++stepCount : null));

  return (
    <div>
      <div className="flex items-center gap-2 mb-2 px-1">
        <div className="w-8 h-4 rounded" style={{ background: "#E8E3DC" }} />
        <p className="text-xs" style={{ color: "#9B9590" }}>グレーの帯を長押しでドラッグ移動</p>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {blocks.map((block, i) => (
              <SortableBlock
                key={block.id}
                block={block}
                stepNumber={stepNumbers[i]}
                onUpdate={(updated) => onChange(blocks.map((b) => (b.id === block.id ? updated : b)))}
                onDelete={() => onChange(blocks.filter((b) => b.id !== block.id))}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => onChange([...blocks, { id: crypto.randomUUID(), type: "step", text: "" }])}
          className="py-3 rounded-xl text-sm font-semibold"
          style={{ border: "1.5px dashed #D5CFC8", color: "#C96A2E", background: "transparent" }}
        >
          ＋ 手順を追加
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="py-3 rounded-xl text-sm font-semibold"
          style={{ border: "1.5px dashed #D5CFC8", color: "#6B7FA3", background: "transparent" }}
        >
          {uploading ? "追加中…" : "＋ 写真を追加"}
        </button>
        <button
          onClick={() => onChange([...blocks, { id: crypto.randomUUID(), type: "memo", text: "" }])}
          className="col-span-2 py-3 rounded-xl text-sm font-semibold"
          style={{ border: "1.5px dashed #FCD34D", color: "#92400E", background: "transparent" }}
        >
          ＋ メモを追加
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handlePhotoFiles(e.target.files)}
      />
    </div>
  );
}
