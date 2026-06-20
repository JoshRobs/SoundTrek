<script setup lang="ts">
import { useRouter } from 'vue-router'
import GameSearchBox from '@/components/GameSearchBox.vue'

const router = useRouter()

function surpriseMe() {
  router.push('/discover')
}
</script>

<template>
  <div class="landing">
    <div class="hero">
      <p class="logo">SoundTrek</p>
      <p class="tagline">Discover video game soundtracks</p>
      <GameSearchBox @select="id => router.push(`/discover?id=${id}`)" />
      <button class="surprise-btn" @click="surpriseMe">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
        Surprise Me
      </button>
    </div>
  </div>
</template>

<style scoped>
.landing {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  background-image: radial-gradient(ellipse at 50% 45%, color-mix(in srgb, var(--accent) 10%, transparent) 0%, transparent 65%);
  padding: 2rem 1rem;
}

.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  width: 100%;
  max-width: 560px;
}

.logo {
  margin: 0;
  font-family: 'Bebas Neue', sans-serif;
  font-size: clamp(3.5rem, 10vw, 5.5rem);
  letter-spacing: 0.06em;
  line-height: 1;
  color: var(--text-primary);
  text-align: center;
}

.tagline {
  margin: -0.5rem 0 0.5rem;
  font-size: 0.9rem;
  color: var(--text-muted);
  text-align: center;
  letter-spacing: 0.03em;
}

.surprise-btn {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.85rem 2.25rem;
  border-radius: 12px;
  border: none;
  background: var(--accent);
  color: #fff;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s, box-shadow 0.15s;
  box-shadow: 0 4px 20px color-mix(in srgb, var(--accent) 40%, transparent);
}

.surprise-btn:hover {
  background: var(--accent-hover);
  box-shadow: 0 6px 28px color-mix(in srgb, var(--accent) 55%, transparent);
  transform: translateY(-1px);
}

.surprise-btn:active { transform: translateY(0); }
</style>
