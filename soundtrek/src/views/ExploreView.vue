<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useSoundtrackStore } from "@/stores/soundtracks";
import ExploreRow from "@/components/ExploreRow.vue";

const store = useSoundtrackStore();
const { exploreRows, loading } = storeToRefs(store);
store.loadAll();
</script>

<template>
  <div class="page">
    <div class="page-inner">
      <header class="hero">
        <h1 class="hero-title">Explore</h1>
        <p class="hero-sub">
          Browse soundtracks by genre, mood, theme, and platform
        </p>
      </header>

      <div v-if="loading" class="state">
        <div class="spinner" style="--spinner-size: 28px" />
      </div>

      <div v-else-if="exploreRows.length === 0" class="state">
        <p>No soundtracks available yet.</p>
      </div>

      <div v-else class="rows">
        <ExploreRow
          v-for="row in exploreRows"
          :key="`${row.type}-${row.label}`"
          :type="row.type"
          :label="row.label"
          :items="row.items"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  flex: 1;
  overflow-y: auto;
}

.page-inner {
  max-width: 1360px;
  width: 100%;
  margin: 0 auto;
  padding: 0 2rem 4rem;
}

.hero {
  padding: 2.5rem 0 2rem;
}

.hero-title {
  font-family: "Bebas Neue", sans-serif;
  font-size: clamp(2.5rem, 6vw, 3.5rem);
  letter-spacing: 0.04em;
  color: var(--text-primary);
  line-height: 1;
  margin: 0 0 0.4rem;
}

.hero-sub {
  font-size: 0.9rem;
  color: var(--text-muted);
  margin: 0;
}

.rows {
  display: flex;
  flex-direction: column;
  gap: 2.75rem;
}

.state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 4rem;
  color: var(--text-muted);
  font-size: 0.9rem;
  text-align: center;
}
</style>
