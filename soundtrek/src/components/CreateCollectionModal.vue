<script setup lang="ts">
import { ref, watch } from "vue";
import { useCollectionStore } from "@/stores/collections";
import type { Collection } from "@/types/collection";

const props = defineProps<{
  open: boolean;
  editing?: Collection | null;
}>();

const emit = defineEmits<{
  close: [];
  created: [collection: Collection];
  updated: [];
}>();

const store = useCollectionStore();

const name = ref("");
const description = ref("");
const isPublic = ref(true);
const tagInput = ref("");
const tags = ref<string[]>([]);
const saving = ref(false);
const error = ref<string | null>(null);

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    if (props.editing) {
      name.value = props.editing.name;
      description.value = props.editing.description ?? "";
      isPublic.value = props.editing.is_public;
      tags.value = [...(props.editing.theme_tags ?? [])];
    } else {
      name.value = "";
      description.value = "";
      isPublic.value = true;
      tags.value = [];
    }
    tagInput.value = "";
    error.value = null;
  },
);

function addTag() {
  const t = tagInput.value.trim().toLowerCase();
  if (!t || tags.value.includes(t) || tags.value.length >= 3) return;
  tags.value.push(t);
  tagInput.value = "";
}

function removeTag(t: string) {
  tags.value = tags.value.filter((x) => x !== t);
}

function onTagKey(e: KeyboardEvent) {
  if (e.key === "Enter" || e.key === ",") {
    e.preventDefault();
    addTag();
  }
}

async function submit() {
  error.value = null;
  if (!name.value.trim()) {
    error.value = "Name is required.";
    return;
  }
  saving.value = true;

  if (props.editing) {
    const ok = await store.updateCollection(props.editing.id, {
      name: name.value.trim(),
      description: description.value.trim() || null,
      is_public: isPublic.value,
      theme_tags: tags.value,
    });
    saving.value = false;
    if (ok) emit("updated");
    else error.value = "Failed to save.";
  } else {
    const c = await store.createCollection({
      name: name.value.trim(),
      description: description.value.trim() || undefined,
      is_public: isPublic.value,
      theme_tags: tags.value,
    });
    saving.value = false;
    if (c) emit("created", c);
    else error.value = "Failed to create collection.";
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="backdrop" @click.self="emit('close')">
      <div class="modal">
        <div class="modal-header">
          <h2>{{ editing ? "Edit Collection" : "New Collection" }}</h2>
          <button class="close-btn" @click="emit('close')">✕</button>
        </div>

        <div class="modal-body">
          <label class="field">
            <span>Name *</span>
            <input
              v-model="name"
              type="text"
              placeholder="My Collection"
              maxlength="100"
            />
          </label>

          <label class="field">
            <span>Description</span>
            <textarea
              v-model="description"
              rows="2"
              placeholder="Optional description…"
              maxlength="300"
            />
          </label>

          <div class="field">
            <span>Theme Tags <em>(up to 3)</em></span>
            <div class="tag-input-row">
              <input
                v-model="tagInput"
                type="text"
                placeholder="Add tag…"
                :disabled="tags.length >= 3"
                @keydown="onTagKey"
              />
              <button
                type="button"
                class="add-tag-btn"
                :disabled="tags.length >= 3"
                @click="addTag"
              >
                Add
              </button>
            </div>
            <div v-if="tags.length" class="tags">
              <span v-for="t in tags" :key="t" class="tag">
                {{ t }}
                <button type="button" @click="removeTag(t)">×</button>
              </span>
            </div>
          </div>

          <div class="field visibility-row">
            <span>Visibility</span>
            <div class="toggle-group">
              <button
                type="button"
                class="toggle-btn"
                :class="{ active: isPublic }"
                @click="isPublic = true"
              >
                Public
              </button>
              <button
                type="button"
                class="toggle-btn"
                :class="{ active: !isPublic }"
                @click="isPublic = false"
              >
                Private
              </button>
            </div>
            <p class="field-hint">
              {{
                isPublic
                  ? "Anyone with the link can view this collection."
                  : "Only you can see this collection."
              }}
            </p>
          </div>

          <p v-if="error" class="error-msg">{{ error }}</p>
        </div>

        <div class="modal-footer">
          <button class="btn btn--ghost" @click="emit('close')">Cancel</button>
          <button class="btn btn--primary" :disabled="saving" @click="submit">
            {{
              saving
                ? "Saving…"
                : editing
                  ? "Save Changes"
                  : "Create Collection"
            }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: 1rem;
}
.modal {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 14px;
  width: 100%;
  max-width: 540px;
  display: flex;
  flex-direction: column;
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.25rem 0;
}
.modal-header h2 {
  font-size: 1.6rem;
  font-weight: 700;
  margin: 0;
}
.close-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 1.5rem;
  padding: 0.2rem;
}
.close-btn:hover {
  color: var(--text-primary);
}
.modal-body {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 1.1rem;
  color: var(--text-secondary);
}
.field em {
  font-style: normal;
  color: var(--text-muted);
  font-size: 0.95rem;
}
.field input,
.field textarea {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 7px;
  padding: 0.5rem 0.7rem;
  font-size: 1rem;
  color: var(--text-primary);
  font-family: inherit;
  resize: none;
}
.field input:focus,
.field textarea:focus {
  outline: none;
  border-color: var(--accent);
}
.tag-input-row {
  display: flex;
  gap: 0.5rem;
}
.tag-input-row input {
  flex: 1;
}
.add-tag-btn {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 7px;
  padding: 0.5rem 0.75rem;
  font-size: 0.92rem;
  color: var(--text-secondary);
  cursor: pointer;
}
.add-tag-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.add-tag-btn:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.25rem;
}
.tag {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  color: "#ffffff";
  border-radius: 99px;
  padding: 0.2rem 0.5rem 0.2rem 0.65rem;
  font-size: 1rem;
}
.tag button {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 0.9rem;
  line-height: 1;
  padding: 0;
}
.visibility-row {
  gap: 0.5rem;
}
.toggle-group {
  display: flex;
  border: 1px solid var(--border);
  border-radius: 7px;
  overflow: hidden;
  width: fit-content;
}
.toggle-btn {
  padding: 0.4rem 1rem;
  font-size: 0.82rem;
  cursor: pointer;
  background: none;
  border: none;
  color: var(--text-muted);
  transition:
    background 0.12s,
    color 0.12s;
}
.toggle-btn.active {
  background: var(--accent);
  color: #fff;
}
.field-hint {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin: 0;
}
.error-msg {
  font-size: 0.82rem;
  color: #f87171;
  margin: 0;
}
.modal-footer {
  padding: 0 1.25rem 1.25rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
}
.btn {
  padding: 0.5rem 1.1rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
}
.btn--ghost {
  background: var(--surface);
  color: var(--text-secondary);
  border: 1px solid var(--border);
}
.btn--ghost:hover {
  color: var(--text-primary);
}
.btn--primary {
  background: var(--accent);
  color: #fff;
}
.btn--primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
