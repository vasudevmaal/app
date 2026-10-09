"use client";
import { useState } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import {
  collectionContent,
  type FAQ,
  type ContentMetadata,
  type CollectionContent,
} from "@/lib/content";
import type { Settings } from "@/lib/types";

function TextField({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {multiline ? (
        <textarea
          rows={4}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}
function CheckField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
export function FAQFields({
  items,
  onChange,
}: {
  items: FAQ[];
  onChange: (v: FAQ[]) => void;
}) {
  function move(i: number, direction: number) {
    const next = [...items];
    [next[i], next[i + direction]] = [next[i + direction], next[i]];
    onChange(next);
  }
  return (
    <div className="repeat-fields">
      {items.map((item, i) => (
        <div className="repeat-field" key={i}>
          <div className="section-title">
            <strong>Question {i + 1}</strong>
            <div className="toolbar-actions">
              <button
                type="button"
                className="icon-button"
                title="Move question up"
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                <ArrowUp size={15} />
              </button>
              <button
                type="button"
                className="icon-button"
                title="Move question down"
                disabled={i === items.length - 1}
                onClick={() => move(i, 1)}
              >
                <ArrowDown size={15} />
              </button>
              <button
                type="button"
                className="icon-button danger"
                title="Remove question"
                onClick={() => onChange(items.filter((_, j) => i !== j))}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
          <TextField
            label="Question"
            value={item.question}
            onChange={(value) =>
              onChange(
                items.map((f, j) => (j === i ? { ...f, question: value } : f)),
              )
            }
          />
          <TextField
            label="Answer"
            value={item.answer}
            multiline
            onChange={(value) =>
              onChange(
                items.map((f, j) => (j === i ? { ...f, answer: value } : f)),
              )
            }
          />
          <CheckField
            label="Active"
            checked={item.active}
            onChange={(active) =>
              onChange(items.map((f, j) => (j === i ? { ...f, active } : f)))
            }
          />
        </div>
      ))}
      <button
        type="button"
        className="button"
        disabled={items.length >= 40}
        onClick={() =>
          onChange([...items, { question: "", answer: "", active: true }])
        }
      >
        <Plus size={15} />
        Add question
      </button>
    </div>
  );
}
export function MetadataFields({
  kind,
  slug,
  metadata,
  onChange,
}: {
  kind: string;
  slug: string;
  metadata: ContentMetadata;
  onChange: (v: ContentMetadata) => void;
}) {
  const patch = (v: Partial<ContentMetadata>) =>
    onChange({ ...metadata, ...v });
  return (
    <>
      <CheckField
        label="Featured style"
        checked={!!metadata.featured}
        onChange={(featured) => patch({ featured })}
      />
      {kind === "ai" && (
        <details open>
          <summary>AI letter images</summary>
          <TextField
            label="Alphabet folder"
            value={metadata.ai?.asset_path ?? `/ai/imgs7727/${slug}`}
            onChange={(asset_path) =>
              patch({
                ai: {
                  asset_path,
                  characters:
                    metadata.ai?.characters ??
                    "ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789",
                },
              })
            }
          />
          <TextField
            label="Available characters"
            value={
              metadata.ai?.characters ?? "ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789"
            }
            onChange={(characters) =>
              patch({
                ai: {
                  asset_path: metadata.ai?.asset_path ?? `/ai/imgs7727/${slug}`,
                  characters: characters.toUpperCase(),
                },
              })
            }
          />
        </details>
      )}
      <details>
        <summary>Page FAQ</summary>
        <CheckField
          label="Show FAQ"
          checked={metadata.faq_enabled !== false}
          onChange={(faq_enabled) => patch({ faq_enabled })}
        />
        <FAQFields
          items={metadata.faq || []}
          onChange={(faq) => patch({ faq })}
        />
        {metadata.faq && (
          <button
            className="text-button"
            type="button"
            onClick={() => {
              const next = { ...metadata };
              delete next.faq;
              delete next.faq_enabled;
              onChange(next);
            }}
          >
            Use collection FAQ
          </button>
        )}
      </details>
    </>
  );
}
export function CollectionFields({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (value: Record<string, CollectionContent>) => void;
}) {
  const [kind, setKind] = useState("home");
  const value = collectionContent(settings, kind);
  const patch = (next: Partial<CollectionContent>) =>
    onChange({
      ...((settings.collection_content as Record<string, CollectionContent>) ||
        {}),
      [kind]: { ...value, ...next },
    });
  return (
    <>
      <label className="field">
        <span>Page / collection</span>
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="home">Home</option>
          <option value="faq">FAQ page</option>
          {settings.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <TextField
        label="Page heading"
        value={value.title}
        onChange={(title) => patch({ title })}
      />
      <TextField
        label="Description"
        multiline
        value={value.description}
        onChange={(description) => patch({ description })}
      />
      <TextField
        label="SEO title"
        value={value.seo_title}
        onChange={(seo_title) => patch({ seo_title })}
      />
      <TextField
        label="SEO description"
        multiline
        value={value.seo_description}
        onChange={(seo_description) => patch({ seo_description })}
      />
      <TextField
        label="Footer SEO heading"
        value={value.footer_title}
        onChange={(footer_title) => patch({ footer_title })}
      />
      <TextField
        label="Footer SEO text"
        multiline
        value={value.footer_description}
        onChange={(footer_description) => patch({ footer_description })}
      />
      <CheckField
        label="Show how it works"
        checked={value.how_to_enabled}
        onChange={(how_to_enabled) => patch({ how_to_enabled })}
      />
      {value.how_to.map((step, i) => (
        <div className="repeat-field" key={i}>
          <TextField
            label={`Step ${i + 1} title`}
            value={step.title}
            onChange={(title) =>
              patch({
                how_to: value.how_to.map((s, j) =>
                  j === i ? { ...s, title } : s,
                ),
              })
            }
          />
          <TextField
            label="Step description"
            multiline
            value={step.description}
            onChange={(description) =>
              patch({
                how_to: value.how_to.map((s, j) =>
                  j === i ? { ...s, description } : s,
                ),
              })
            }
          />
          <button
            className="icon-button danger"
            title="Remove step"
            type="button"
            onClick={() =>
              patch({ how_to: value.how_to.filter((_, j) => i !== j) })
            }
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <button
        className="button"
        type="button"
        disabled={value.how_to.length >= 20}
        onClick={() =>
          patch({ how_to: [...value.how_to, { title: "", description: "" }] })
        }
      >
        <Plus size={16} />
        Add step
      </button>
      <CheckField
        label="Show FAQ"
        checked={value.faq_enabled}
        onChange={(faq_enabled) => patch({ faq_enabled })}
      />
      <FAQFields items={value.faq} onChange={(faq) => patch({ faq })} />
    </>
  );
}
