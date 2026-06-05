<script lang="ts">
  import { Button } from '#lib/components/ui/button/index.ts';
  import SettingsNav from '#lib/components/SettingsNav.svelte';
</script>

<svelte:head><title>Your data · Settings · wunan</title></svelte:head>

<section class="grid gap-8">
  <div class="grid gap-4">
    <h1 class="text-2xl font-semibold">Settings</h1>
    <SettingsNav />
  </div>

  <section class="grid max-w-xl gap-4" aria-labelledby="export-heading">
    <h2 id="export-heading" class="text-xl font-semibold">Download your data</h2>
    <p>
      You can download everything wunan keeps about you, whenever you like. It comes as one ZIP
      file with:
    </p>
    <ul class="grid list-disc gap-1 pl-6">
      <li>your profile and contact details,</li>
      <li>your listings and their photos,</li>
      <li>your agreements and requests for help,</li>
      <li>your conversations and messages,</li>
      <li>the invitations you made, and your notification settings.</li>
    </ul>
    <p class="text-muted-foreground">
      The data is in a file called my-wunan-data.json, which opens in any text editor. A README file
      explains each part. Other members appear by their display name only.
    </p>
    <div><Button href="/settings/export/download" download>Download my data</Button></div>
  </section>
</section>
