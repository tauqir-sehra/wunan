<!--
  Every settings page shares this header: the heading, help for the page on screen, and the
  settings sections. Being one piece, it stays exactly in place when moving between sections.
-->
<script lang="ts">
  import { page } from '$app/state';
  import HelpLink from '#lib/components/HelpLink.svelte';
  import SettingsNav from '#lib/components/SettingsNav.svelte';

  let { children } = $props();
  const help = $derived(
    page.url.pathname.startsWith('/settings/notifications')
      ? { topic: 'notifications', label: 'Help with notifications' }
      : page.url.pathname.startsWith('/settings/export') || page.url.pathname.startsWith('/settings/delete-account')
        ? { topic: 'your-data', label: 'Help with your data and leaving' }
        : { topic: 'joining', label: 'Help with your profile' }
  );
</script>

<div class="grid gap-8">
  <div class="grid gap-4">
    <div class="flex items-start justify-between gap-3">
      <h1 class="text-2xl font-semibold">Settings</h1>
      <HelpLink topic={help.topic} label={help.label} />
    </div>
    <SettingsNav />
  </div>
  {@render children()}
</div>
