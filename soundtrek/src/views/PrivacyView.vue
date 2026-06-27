<script setup lang="ts">
import { useHead } from "@unhead/vue";
import privacyHtml from "@/assets/privacy-policy.html?raw";

useHead({
  title: "Privacy Policy | SoundTrek",
  meta: [
    { name: "description", content: "Privacy policy for SoundTrek." },
    { property: "og:title", content: "Privacy Policy | SoundTrek" },
    { property: "og:url", content: "https://soundtrek.app/privacy" },
  ],
});
</script>

<template>
  <div class="privacy-page">
    <div class="privacy-inner" v-html="privacyHtml" />

    <div class="privacy-inner youtube-section">
      <h2>YouTube API Services</h2>
      <p>
        SoundTrek uses the YouTube API Services to search for and display game
        soundtrack videos and playlists. By using SoundTrek, you agree to be
        bound by the
        <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener"
          >YouTube Terms of Service</a
        >.
      </p>
      <p>
        Our use of information received from YouTube API Services is governed by
        the
        <a
          href="https://policies.google.com/privacy"
          target="_blank"
          rel="noopener"
          >Google Privacy Policy</a
        >.
      </p>
      <h3>Data Collected via YouTube API</h3>
      <p>
        When you use SoundTrek, our server-side ingestion process uses the
        YouTube Data API to search for publicly available soundtrack playlists
        and videos. We store only the YouTube video and playlist IDs (e.g.
        <code>dQw4w9WgXcQ</code>) in our database — no user-specific YouTube
        data is collected or retained.
      </p>
      <h3>Data Deletion</h3>
      <p>
        We do not store any personal YouTube account data or OAuth tokens. If
        you believe any of your data has been collected in error, you may
        contact us at
        <a href="mailto:jdr.joshuaroberts@gmail.com"
          >jdr.joshuaroberts@gmail.com</a
        >
        to request deletion. You can also revoke any Google permissions granted
        to SoundTrek at any time via
        <a
          href="https://security.google.com/settings/security/permissions"
          target="_blank"
          rel="noopener"
          >Google Security Settings</a
        >.
      </p>
    </div>
  </div>
</template>

<style scoped>
.privacy-page {
  padding: 3rem 2rem 5rem;
}

.privacy-inner {
  max-width: 760px;
  margin: 0 auto;
}

/* Override Termly's hardcoded light-mode colors with site theme */
.privacy-inner :deep(*) {
  background: transparent !important;
  font-family: inherit !important;
}

.privacy-inner :deep([data-custom-class="title"]),
.privacy-inner :deep([data-custom-class="title"] *) {
  font-size: 2rem !important;
  font-weight: 700 !important;
  color: var(--text-primary) !important;
  margin-bottom: 0.5rem !important;
}

.privacy-inner :deep([data-custom-class="subtitle"]),
.privacy-inner :deep([data-custom-class="subtitle"] *) {
  font-size: 0.85rem !important;
  color: var(--text-muted) !important;
  margin-bottom: 2rem !important;
}

.privacy-inner :deep([data-custom-class="heading_1"]),
.privacy-inner :deep([data-custom-class="heading_1"] *) {
  font-size: 1.2rem !important;
  font-weight: 700 !important;
  color: var(--text-primary) !important;
  margin-top: 2rem !important;
  display: block !important;
}

.privacy-inner :deep([data-custom-class="heading_2"]),
.privacy-inner :deep([data-custom-class="heading_2"] *) {
  font-size: 1rem !important;
  font-weight: 600 !important;
  color: var(--text-primary) !important;
  margin-top: 1.25rem !important;
  display: block !important;
}

.privacy-inner :deep([data-custom-class="body_text"]),
.privacy-inner :deep([data-custom-class="body_text"] *) {
  color: var(--text-secondary) !important;
  font-size: 0.9rem !important;
  line-height: 1.7 !important;
}

.privacy-inner :deep([data-custom-class="link"]),
.privacy-inner :deep([data-custom-class="link"] *) {
  color: var(--accent) !important;
  font-size: 0.9rem !important;
  word-break: break-word !important;
  text-decoration: none !important;
}

.privacy-inner :deep([data-custom-class="link"]:hover) {
  text-decoration: underline !important;
}

.privacy-inner :deep(ul),
.privacy-inner :deep(ol) {
  padding-left: 1.5rem;
  color: var(--text-secondary);
}

.privacy-inner :deep(li) {
  line-height: 1.7;
  font-size: 0.9rem;
}

.privacy-inner :deep(table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.privacy-inner :deep(th),
.privacy-inner :deep(td) {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  color: var(--text-secondary) !important;
  text-align: left;
}

.privacy-inner :deep(th) {
  color: var(--text-primary) !important;
  background: var(--surface-2) !important;
}

.youtube-section {
  margin-top: 3rem;
  padding-top: 2rem;
  border-top: 1px solid var(--border);
}

.youtube-section h2 {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.75rem;
}

.youtube-section h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
}

.youtube-section p {
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.7;
  margin-bottom: 0.75rem;
}

.youtube-section a {
  color: var(--accent);
  text-decoration: none;
}

.youtube-section a:hover {
  text-decoration: underline;
}

.youtube-section code {
  font-family: monospace;
  font-size: 0.85em;
  color: var(--text-muted);
}

@media (max-width: 768px) {
  .privacy-page {
    padding: 2rem 1.25rem 4rem;
  }
}
</style>
