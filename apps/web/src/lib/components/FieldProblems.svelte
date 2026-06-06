<!--
  Under a form's "Some details need fixing." message: each thing to fix, named the way the form
  names it ("When: Please choose a date."), so nothing is left unexplained even if the field it
  belongs to is further down the page or not on this step.
-->
<script lang="ts">
  let {
    fields,
    labels = {}
  }: { fields: Record<string, string> | undefined; labels?: Record<string, string> } = $props();

  // "offers.0.amount" belongs to "offers"; the same message twice is shown once.
  const items = $derived([
    ...new Map(
      Object.entries(fields ?? {}).map(([key, message]) => {
        const label = labels[key] ?? labels[key.split('.')[0]!];
        return [`${label}${message}`, label ? `${label}: ${message}` : message];
      })
    ).values()
  ]);
</script>

{#if items.length}
  <ul class="list-disc pl-5">
    {#each items as item (item)}<li>{item}</li>{/each}
  </ul>
{/if}
