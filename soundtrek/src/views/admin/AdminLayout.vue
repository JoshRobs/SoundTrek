<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuth } from "@/composables/useAuth";
import { useSoundtrackStore } from "@/stores/soundtracks";

// fresh: admin forms hydrate from these rows — never serve them from the
// worker's cached catalog.
useSoundtrackStore().loadAll({ fresh: true });

const route = useRoute();
const router = useRouter();
const { user, signOut } = useAuth();

const navItems = [
  { label: "Dashboard",       path: "/admin" },
  { label: "Add Soundtrack",  path: "/admin/add-soundtrack" },
  { label: "Edit Soundtrack", path: "/admin/edit-soundtrack" },
  { label: "Composers",       path: "/admin/composers" },
  { label: "Fix Links",       path: "/admin/links" },
  { label: "Composer Bios",   path: "/admin/composer-bios" },
];

const currentLabel = computed(
  () => navItems.find((n) => n.path === route.path)?.label ?? "Admin",
);

async function handleSignOut() {
  await signOut();
  router.push("/");
}
</script>

<template>
  <div class="admin-shell">
    <aside class="admin-sidebar">
      <div class="sidebar-header">
        <RouterLink to="/" class="sidebar-logo">SoundTrek</RouterLink>
        <span class="sidebar-badge">Admin</span>
      </div>

      <nav class="sidebar-nav">
        <RouterLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ active: route.path === item.path }"
        >
          {{ item.label }}
        </RouterLink>
      </nav>

      <div class="sidebar-footer">
        <span class="sidebar-user">{{ user?.email }}</span>
        <button class="signout-btn" @click="handleSignOut">Sign out</button>
      </div>
    </aside>

    <main class="admin-main">
      <header class="admin-topbar">
        <h1 class="page-title">{{ currentLabel }}</h1>
      </header>
      <div class="admin-content">
        <RouterView />
      </div>
    </main>
  </div>
</template>

<style scoped>
.admin-shell {
  display: flex;
  height: 100dvh;
  background: #0a0a0a;
  color: var(--text-primary);
  font-family: inherit;
}

.admin-sidebar {
  width: 220px;
  flex-shrink: 0;
  background: #111;
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 1.25rem 1rem;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sidebar-logo {
  font-weight: 700;
  font-size: 1rem;
  color: var(--text-primary);
  text-decoration: none;
}

.sidebar-badge {
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  background: var(--accent);
  color: #fff;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
}

.sidebar-nav {
  flex: 1;
  padding: 0.75rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.nav-item {
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  font-size: 0.875rem;
  color: var(--text-secondary);
  text-decoration: none;
  transition: background 0.12s, color 0.12s;
}

.nav-item:hover {
  background: var(--surface);
  color: var(--text-primary);
}

.nav-item.active {
  background: var(--surface-2);
  color: var(--text-primary);
  font-weight: 600;
}

.sidebar-footer {
  padding: 1rem;
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sidebar-user {
  font-size: 0.75rem;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.signout-btn {
  font-size: 0.8rem;
  color: var(--text-muted);
  background: none;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.35rem 0.6rem;
  cursor: pointer;
  text-align: left;
  transition: color 0.12s, border-color 0.12s;
}

.signout-btn:hover {
  color: var(--text-primary);
  border-color: var(--text-muted);
}

.admin-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.admin-topbar {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border);
  background: #111;
  flex-shrink: 0;
}

.page-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.admin-content {
  flex: 1;
  overflow: auto;
  padding: 1.5rem;
}
</style>
