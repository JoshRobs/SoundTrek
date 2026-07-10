<script setup lang="ts">
import { ref } from "vue";
import { RouterLink, useRouter, useRoute } from "vue-router";
import { useSoundtrackStore } from "@/stores/soundtracks";
import { useIsMobile } from "@/composables/useIsMobile";
import { useAuth } from "@/composables/useAuth";
import RandomizeHeaderButton from "./RandomizeHeaderButton.vue";
import ExploreMenu from "./ExploreMenu.vue";
import GameSearchBox from "./GameSearchBox.vue";
import MobileDrawer from "./MobileDrawer.vue";

const router = useRouter();
const route = useRoute();
const store = useSoundtrackStore();
const { isMobile } = useIsMobile();
const { user, signOut } = useAuth();
const drawerOpen = ref(false);
const menuOpen = ref(false);

function onSearchSelect(
  result: { type: "soundtrack"; id: string } | { type: "composer"; slug: string },
) {
  if (result.type === "composer") router.push(`/composer/${result.slug}`);
  else router.push(`/soundtrack/${result.id}`);
}

function randomPick() {
  store.nextSoundtrack();
  if (route.path !== "/discover") router.push("/discover");
}

function userInitials(): string {
  const name = user.value?.user_metadata?.display_name as string | undefined;
  if (name?.trim()) {
    return name
      .trim()
      .split(/\s+/)
      .map((w: string) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }
  return (user.value?.email ?? "").slice(0, 2).toUpperCase();
}

async function handleSignOut() {
  menuOpen.value = false;
  await signOut();
  router.push("/");
}

function onAvatarBlur(e: FocusEvent) {
  const next = e.relatedTarget as HTMLElement | null;
  if (!next?.closest(".user-menu")) menuOpen.value = false;
}
</script>

<template>
  <header class="header">
    <div class="header-left">
      <RouterLink to="/" class="logo">SoundTrek</RouterLink>
      <RandomizeHeaderButton v-if="!isMobile" @click="randomPick" />
    </div>

    <template v-if="!isMobile">
      <div class="header-center">
        <ExploreMenu />
        <RouterLink to="/catalog" class="nav-link">Catalog</RouterLink>
      </div>
      <div id="header-right" class="header-right">
        <div class="header-search">
          <GameSearchBox
            :autofocus="false"
            :compact="true"
            @select="onSearchSelect"
          />
        </div>

        <RouterLink to="/saved" class="icon-btn" aria-label="Saved soundtracks">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
          Saved Soundtracks
        </RouterLink>

        <!-- Logged out -->
        <RouterLink v-if="!user" to="/login" class="nav-link sign-in-link">
          Sign in
        </RouterLink>

        <!-- Logged in -->
        <div v-else class="user-menu">
          <button
            class="avatar-btn"
            :aria-expanded="menuOpen"
            aria-haspopup="true"
            @click="menuOpen = !menuOpen"
            @blur="onAvatarBlur"
          >
            {{ userInitials() }}
          </button>
          <Transition name="dropdown">
            <div v-if="menuOpen" class="dropdown">
              <div class="dropdown-user">
                {{ user?.user_metadata?.display_name || user?.email }}
              </div>
              <div class="dropdown-divider" />
              <RouterLink
                to="/saved"
                class="dropdown-item"
                @click="menuOpen = false"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
                Saved
              </RouterLink>
              <RouterLink
                to="/account"
                class="dropdown-item"
                @click="menuOpen = false"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                Account
              </RouterLink>
              <div class="dropdown-divider" />
              <button class="dropdown-item" @click="handleSignOut">
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Sign out
              </button>
            </div>
          </Transition>
        </div>
      </div>
    </template>

    <template v-else>
      <div />
      <div id="header-right" class="header-right">
        <button
          class="hamburger"
          aria-label="Open menu"
          @click="drawerOpen = true"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </div>
    </template>
  </header>

  <MobileDrawer v-if="drawerOpen" @close="drawerOpen = false" />
</template>

<style scoped>
.header {
  flex-shrink: 0;
  position: relative;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
  z-index: 10;
  gap: 10px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 40px;
}

.header-center {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: flex-end;
}

.logo {
  font-family: "Bebas Neue", sans-serif;
  font-size: 1.5rem;
  letter-spacing: 0.06em;
  text-decoration: none;
  background: linear-gradient(
    to right,
    var(--accent) 50%,
    var(--text-primary) 50%
  );
  background-size: 200% 100%;
  background-position: right;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
  transition: background-position 0.4s ease;
}

.logo:hover {
  background-position: left;
}

.nav-link {
  padding: 0.4rem 0.75rem;
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 0.85rem;
  font-weight: 500;
  text-decoration: none;
  transition:
    color 0.15s,
    background 0.15s;
}

.nav-link:hover,
.nav-link.router-link-active {
  color: var(--text-primary);
  background: var(--surface-2);
}

.sign-in-link {
  white-space: nowrap;
}

.icon-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.75rem;
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 0.85rem;
  font-weight: 500;
  text-decoration: none;
  transition:
    background 0.15s,
    color 0.15s;
}

.icon-btn:hover,
.icon-btn.router-link-active {
  background: var(--surface-2);
  color: var(--text-primary);
}

.header-search {
  width: 300px;
}

/* ── User menu ────────────────────────────────────────────────────────────── */
.user-menu {
  position: relative;
}

.avatar-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-primary);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    border-color 0.15s,
    background 0.15s;
}

.avatar-btn:hover {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, var(--surface-2));
}

.dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 160px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0.35rem;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  z-index: 100;
}

.dropdown-user {
  padding: 0.4rem 0.75rem 0.25rem;
  font-size: 1rem;
  color: white;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 180px;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  padding: 0.55rem 0.75rem;
  border-radius: 7px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.85rem;
  text-decoration: none;
  cursor: pointer;
  transition:
    background 0.12s,
    color 0.12s;
  text-align: left;
}

.dropdown-item:hover {
  background: var(--surface-2);
  color: var(--text-primary);
}

.dropdown-divider {
  height: 1px;
  background: var(--border);
  margin: 0.25rem 0;
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition:
    opacity 0.12s ease,
    transform 0.12s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* ── Mobile ───────────────────────────────────────────────────────────────── */
.random-btn {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.4rem 0.75rem;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition:
    color 0.15s,
    border-color 0.15s,
    background 0.15s;
}

.random-btn:hover {
  color: var(--text-primary);
  background: var(--surface-2);
  border-color: var(--border);
}

.hamburger {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
}

.hamburger:hover {
  background: var(--surface-2);
  color: var(--text-primary);
}
</style>
