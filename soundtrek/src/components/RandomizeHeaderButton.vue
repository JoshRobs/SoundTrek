<template>
  <span class="start-btn">RANDOMIZE</span>
</template>
<style scoped>
.start-btn {
  text-align: center;
  display: inline-block;
  margin: 5px;
  font-family: "Press Start 2P";
  font-weight: bold;
  padding: 8px 3px 8px 10px;
  letter-spacing: 0.07em;
  background: transparent;
  color: var(--accent-light);
  border-radius: 7px;
  cursor: pointer;
  transition:
    color 0.2s ease,
    text-shadow 0.2s ease,
    background 0.2s ease;
}
.start-btn:active {
  box-shadow: none;
  position: relative;
  top: 0.2em;
}
.start-btn:hover {
  color: #fff;
  background: rgba(124, 58, 237, 0.02);
  text-shadow:
    0 0 2px var(--accent-light),
    0 0 24px var(--accent);
}
</style>
