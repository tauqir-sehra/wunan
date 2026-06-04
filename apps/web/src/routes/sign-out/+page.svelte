<script lang="ts">
  import { Button } from '#lib/components/ui/button/index.ts';
</script>

<svelte:head><title>Sign out · wunan</title></svelte:head>

<section class="grid max-w-md gap-5">
  <h1 class="text-2xl font-semibold">Sign out</h1>
  <p>You can sign back in any time with your email and password.</p>
  <form method="POST"><Button type="submit">Sign out</Button></form>
</section>
