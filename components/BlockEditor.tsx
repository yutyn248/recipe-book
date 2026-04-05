"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
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

// ─────────────────────────────────────────────
// Grip handle — colored left zone, unmistakable
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
      }}
    >
      {/* 2×3 grip dots */}
      {[0, 1, 2].map((row) => (
        <span key={row} className="flex gap-[4px]">
          {[0, 1].map((col) => (
            <span
              key={col}
              className="block rounded-full"
              style={{ width: 4, height: 4, background: "#9B9590" }}
            />
          ))}
        </span>
      ))}
    </button>
  );
}

// ─────────────────────────────────────────────
// Step number badge — hardcoded dark, never white
// ─────────────────────────────────────────────
function StepBadge({ num }: { num: number | null }) {
  return (
    <div
      className="flex-shrink-0 flex items-center justify-center rounded-full font-black"
      style={{
        width: 34,
        height: 34,
        minWidth: 34,
        background: "#C96A2E",
        color: "#FFFFFF",
        fontSize: 15,
      }}
    >
      {num ?? "·"}
    </div>
  );
}

// ─────────────────────────────────────────────
// Sortable wrapper
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
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.45 : 1,
        zIndex: isDragging ? 50 : undefined,
      }}
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
    return (
      <div
        className="flex overflow-hidden rounded-2xl"
        style={{ background: "#FFFFFF", boxShadow: "0 1px 4px rgba(26,23,18,0.08)", borderLeft: "3px solid #D5CFC8" }}
      >
        <GripZone {...gripProps} />
        <div className="flex-1 py-2 pr-3 flex items-center">
          {/* Fixed aspect ratio photo */}
          <div className="w-full rounded-xl overflow-hidden" style={{ aspectRatio: "4/3", background: "#F0EDE8" }}>
            <img src={block.base64} alt="写真" className="w-full h-full object-cover" />
          </div>
        </div>
        <div className="flex items-center pr-2">
          <button
            onClick={onDelete}
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs"
            style={{ background: "#F0EDE8", color: "#9B9590" }}
          >✕</button>
        </div>
      </div>
    );
  }

  // ── Ingredients ──
  if (block.type === "ingredients") {
    return (
      <IngredientsBlock
        block={block}
        onUpdate={onUpdate}
        onDelete={onDelete}
        gripProps={gripProps}
      />
    );
  }

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
              onChange={(e) => onUpdate({ ...block, text: e.target.value })}
              onBlur={() => setEditing(false)}
              className="w-full leading-relaxed resize-none outline-none bg-transparent min-h-[64px]"
              style={{ color: "#1A1712", borderBottom: "1.5px solid #C96A2E", fontSize: 16 }}
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
        <button
          onClick={onDelete}
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs"
          style={{ background: "#F0EDE8", color: "#9B9590" }}
        >✕</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Ingredients block
// ─────────────────────────────────────────────
function IngredientsBlock({
  block,
  onUpdate,
  onDelete,
  gripProps,
}: {
  block: Extract<Block, { type: "ingredients" }>;
  onUpdate: (updated: Block) => void;
  onDelete: () => void;
  gripProps: object;
}) {
  const [expanded, setExpanded] = useState(false);

  function updateItem(i: number, value: string) {
    const items = [...block.items];
    items[i] = value;
    onUpdate({ ...block, items });
  }

  function removeItem(i: number) {
    onUpdate({ ...block, items: block.items.filter((_, idx) => idx !== i) });
  }

  return (
    <div
      className="overflow-hidden rounded-2xl"
      style={{ background: "#FFFFFF", boxShadow: "0 1px 4px rgba(26,23,18,0.08)", borderLeft: "3px solid #D5CFC8" }}
    >
      <div className="flex">
        <GripZone {...gripProps} />
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 text-left py-3 px-3"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-0.5" style={{ color: "#9B9590" }}>材料</p>
              <p className="text-sm font-medium" style={{ color: "#1A1712" }}>{block.items.length}品目</p>
            </div>
            <span className="text-xs mr-2" style={{ color: "#9B9590" }}>{expanded ? "▲" : "▼"}</span>
          </div>
        </button>
        <div className="flex items-center pr-2">
          <button
            onClick={onDelete}
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs"
            style={{ background: "#F0EDE8", color: "#9B9590" }}
          >✕</button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4" style={{ borderTop: "1px solid #F0EDE8" }}>
          <div className="mt-3 space-y-2">
            {block.items.map((item, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  value={item}
                  onChange={(e) => updateItem(i, e.target.value)}
                  className="flex-1 outline-none py-1.5 bg-transparent"
                  style={{ color: "#1A1712", borderBottom: "1px solid #E8E4DF", fontSize: 16 }}
                  placeholder="材料（分量）"
                />
                <button
                  onClick={() => removeItem(i)}
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0"
                  style={{ background: "#F0EDE8", color: "#9B9590" }}
                >✕</button>
              </div>
            ))}
          </div>
          <button
            onClick={() => onUpdate({ ...block, items: [...block.items, ""] })}
            className="mt-3 text-sm font-semibold"
            style={{ color: "#C96A2E" }}
          >
            ＋ 材料を追加
          </button>
        </div>
      )}
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
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = blocks.findIndex((b) => b.id === active.id);
      const newIdx = blocks.findIndex((b) => b.id === over.id);
      onChange(arrayMove(blocks, oldIdx, newIdx));
    }
  }

  // Pre-compute step numbers so they update live during reorder
  let stepCount = 0;
  const stepNumbers = blocks.map((b) => (b.type === "step" ? ++stepCount : null));

  return (
    <div>
      {/* Hint label */}
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

      <button
        onClick={() => onChange([...blocks, { id: crypto.randomUUID(), type: "step", text: "" }])}
        className="mt-3 w-full py-3 rounded-xl text-sm font-semibold"
        style={{ border: "1.5px dashed #D5CFC8", color: "#C96A2E", background: "transparent" }}
      >
        ＋ 手順を追加
      </button>
    </div>
  );
}
