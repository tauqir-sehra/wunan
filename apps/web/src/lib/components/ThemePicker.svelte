<!--
  Light, dark, or following the device ("Auto"), at the bottom of the menu. With JavaScript the
  colours change at once and the menu stays open; the choice is saved for this device. Without
  JavaScript it's a small form that posts to /theme and comes back to the same page.
-->
<script lang="ts">
  import { page } from '$app/state';
  import MonitorIcon from '@lucide/svelte/icons/monitor';
  import MoonIcon from '@lucide/svelte/icons/moon';
  import SunIcon from '@lucide/svelte/icons/sun';
  import type { Theme } from '#lib/theme.ts';

  let { theme = $bindable() }: { theme: Theme } = $props();

  const choices = [
    { value: 'system', label: 'Auto', title: 'Follow your device', icon: MonitorIcon },
    { value: 'light', label: 'Light', title: 'Light colours', icon: SunIcon },
    { value: 'dark', label: 'Dark', title: 'Dark colours', icon: MoonIcon }
  ] as const;

  async function choose(event: SubmitEvent) {
    const button = event.submitter as HTMLButtonElement | null;
    if (!button) return;
    event.preventDefault();
    theme = button.value as Theme;
    document.documentElement.dataset.theme = theme;
    const body = new FormData();
    body.set('theme', theme);
    // If saving fails, the colours still change for now; it's only remembered next time.
    await fetch('/theme', { method: 'POST', body, headers: { accept: 'application/json' } }).catch(
      () => {}
    );
  }
</script>

<form method="POST" action="/theme" onsubmit={choose}>
  <input type="hidden" name="back" value={page.url.pathname + page.url.search} />
  <fieldset class="grid gap-1 px-3 py-1">
    <legend class="sr-only">Colours</legend>
    <div class="grid grid-cols-3 gap-1">
      {#each choices as choice (choice.value)}
        <button
          type="submit"
          name="theme"
          value={choice.value}
          title={choice.title}
          aria-pressed={theme === choice.value}
          class="inline-flex min-h-11 items-center justify-center gap-1 rounded-md px-1 text-sm hover:bg-accent aria-pressed:bg-accent aria-pressed:ring-2 aria-pressed:ring-primary aria-pressed:ring-inset"
        >
          <choice.icon class="size-4 shrink-0" aria-hidden="true" />{choice.label}
        </button>
      {/each}
    </div>
  </fieldset>
</form>
