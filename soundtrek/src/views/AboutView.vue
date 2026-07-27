<script setup lang="ts">
import { useHead } from "@unhead/vue";
import { RouterLink } from "vue-router";

useHead({
  title: "About | SoundTrek",
  meta: [
    {
      name: "description",
      content:
        "SoundTrek is a discovery site for video game soundtracks — browse thousands of game OSTs, explore the composers and studios behind them, and build your own collections.",
    },
    { property: "og:title", content: "About | SoundTrek" },
    {
      property: "og:description",
      content:
        "What SoundTrek is, why it exists, and how it works — a fan-made home for video game music.",
    },
    { property: "og:url", content: "https://soundtrek.app/about" },
  ],
});
</script>

<template>
  <div class="about-page">
    <article class="about-inner">
      <header class="about-header">
        <p class="about-eyebrow">About</p>
        <h1 class="about-title">SoundTrek</h1>
        <p class="about-lede">
          SoundTrek is a home for video game music. A place to discover the
          soundtracks behind the games you love, one at a time.
        </p>
      </header>

      <section class="about-section">
        <h2>What SoundTrek is</h2>
        <p>
          Game soundtracks are some of the most-listened-to and least-credited
          music in the world. A score can define how a game feels, stay with you
          for years, and send you searching for a track you only know as
          &ldquo;the one from that boss fight&rdquo; yet the composers behind it
          are often invisible, and the music itself is scattered across dozens
          of playlists and uploads.
        </p>
        <p>
          SoundTrek pulls that world into one place. It's a catalogue of
          thousands of video game soundtracks, each on its own page with the
          full score ready to play, the studio and release year, the genres it
          belongs to, and the composers who wrote it.
        </p>
      </section>

      <section class="about-section">
        <h2>Why it exists</h2>
        <p>
          I love listening to video game soundtracks, but found discovering new
          soundtracks to be a difficult experience. It was always either through
          Youtube's sidebar recommendations or Spotify's algorithmic playlists.
          I wanted to make something a bit more focused, with soundtracks I'd
          never heard of, and that weren't necessarily the most popular.
        </p>
        <p>
          The goal is to give game music the kind of catalogue that films and
          albums have long had, and in the process, to put composers' names back
          next to their work. A soundtrack you love should be one click away
          from the person who wrote it and everything else they've scored.
        </p>
      </section>

      <section class="about-section">
        <h2>What you can do here</h2>
        <ul class="about-list">
          <li>
            <strong>Discover soundtracks</strong> one at a time from the
            randomizer, or browse the full catalogue by genre, theme, studio,
            etc...
          </li>
          <li>
            <strong>Explore composers and studios</strong> - every soundtrack
            links to the people and teams behind it, each with their own page
            gathering their full body of work.
          </li>
          <li>
            <strong>Build collections</strong> - save the soundtracks and
            individual tracks you love into your own collections, and play them
            straight through.
          </li>
          <li>
            <strong>Follow the charts</strong> - see the most-loved soundtracks
            and the most-celebrated composers, ranked by the community.
          </li>
          <li>
            <strong>Like, save, and review</strong> the soundtracks that matter
            to you, and help shape what rises to the top.
          </li>
        </ul>
      </section>

      <section class="about-section">
        <h2>Where the information comes from</h2>
        <p>
          SoundTrek is a discovery layer, not a rights holder. Game details,
          titles, cover art, studios, release dates, and genres all come from
          <a href="https://www.igdb.com" target="_blank" rel="noopener">IGDB</a
          >, the community-run video game database. The music itself is streamed
          from publicly available playlists and videos on YouTube; we store only
          the references needed to play a soundtrack, and playback happens
          through YouTube's own player.
        </p>
        <p>
          All game titles, artwork, and soundtracks remain the property of their
          respective creators and rights holders. SoundTrek is a fan project
          built to point people <em>toward</em> that work. To help you find a
          score, discover its composer, and, where you can, support them by
          buying the official release.
        </p>
      </section>

      <section class="about-section">
        <h2>Who makes it</h2>
        <p>
          SoundTrek is an independent project built and maintained by Joshua
          Roberts. That's me! It isn't affiliated with any game studio,
          publisher, or music label. It's a labour of love for game music, and
          it grows a little every week.
        </p>
      </section>

      <section class="about-section">
        <h2>Get involved</h2>
        <p>
          Spot a soundtrack that's missing, a broken link, or a composer who
          deserves credit? Contributions genuinely make the site better. There's
          links at the bottom of the homepage to submit a soundtrack, report an
          issue, or get in touch.
        </p>
        <p class="about-cta-row">
          <RouterLink to="/submit" class="about-cta"
            >Submit a soundtrack</RouterLink
          >
          <RouterLink to="/contact" class="about-cta about-cta--ghost"
            >Get in touch</RouterLink
          >
        </p>
      </section>
    </article>
  </div>
</template>

<style scoped>
.about-page {
  padding: 3rem 2rem 5rem;
}

.about-inner {
  max-width: 760px;
  margin: 0 auto;
}

.about-header {
  margin-bottom: 2.5rem;
}

.about-eyebrow {
  margin: 0 0 0.35rem;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--accent);
}

.about-title {
  margin: 0 0 1rem;
  font-family: "Bebas Neue", sans-serif;
  font-size: clamp(2.75rem, 7vw, 4rem);
  font-weight: 400;
  letter-spacing: 0.04em;
  line-height: 1;
  color: var(--text-primary);
}

.about-lede {
  margin: 0;
  font-size: 1.1rem;
  line-height: 1.6;
  color: var(--text-secondary);
}

.about-section {
  margin-top: 2.5rem;
}

.about-section h2 {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 0.75rem;
}

.about-section p {
  margin: 0 0 0.9rem;
  font-size: 0.95rem;
  line-height: 1.75;
  color: var(--text-secondary);
}

.about-section em {
  font-style: italic;
  color: var(--text-secondary);
}

.about-section a {
  color: var(--accent);
  text-decoration: none;
}

.about-section a:hover {
  text-decoration: underline;
}

.about-list {
  margin: 0;
  padding-left: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.about-list li {
  font-size: 0.95rem;
  line-height: 1.7;
  color: var(--text-secondary);
}

.about-list strong {
  color: var(--text-primary);
  font-weight: 600;
}

.about-cta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1.25rem;
}

.about-cta {
  display: inline-flex;
  align-items: center;
  padding: 0.6rem 1.2rem;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  text-decoration: none;
  background: var(--accent);
  color: #fff !important;
  transition: opacity 0.15s;
}

.about-cta:hover {
  opacity: 0.9;
  text-decoration: none;
}

.about-cta--ghost {
  background: transparent;
  color: var(--text-primary);
  border: 1px solid var(--border);
}

.about-cta--ghost:hover {
  border-color: var(--accent);
  color: var(--accent);
}

@media (max-width: 768px) {
  .about-page {
    padding: 2rem 1.25rem 4rem;
  }

  .about-lede {
    font-size: 1rem;
  }
}
</style>
