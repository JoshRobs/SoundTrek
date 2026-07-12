<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useSoundtrackStore } from "@/stores/soundtracks";

const { allSoundtracks } = storeToRefs(useSoundtrackStore());
</script>

<template>
  <div class="dashboard">
    <div class="stat-grid">
      <div class="stat-card">
        <p class="stat-label">Total Soundtracks</p>
        <p class="stat-value">{{ allSoundtracks.length.toLocaleString() }}</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">With YouTube</p>
        <p class="stat-value">
          {{ allSoundtracks.filter(s => s.youtube_video_id || s.youtube_playlist_id).length.toLocaleString() }}
        </p>
      </div>
      <div class="stat-card">
        <p class="stat-label">With Spotify</p>
        <p class="stat-value">
          {{ allSoundtracks.filter(s => s.spotify_id).length.toLocaleString() }}
        </p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Missing Slug</p>
        <p class="stat-value">
          {{ allSoundtracks.filter(s => !s.slug).length.toLocaleString() }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  max-width: 900px;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
}

.stat-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 1.25rem 1.5rem;
}

.stat-label {
  font-size: 0.78rem;
  color: var(--text-muted);
  margin: 0 0 0.4rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  font-variant-numeric: tabular-nums;
}
</style>
