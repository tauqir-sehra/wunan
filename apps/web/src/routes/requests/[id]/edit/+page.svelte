<script lang="ts">
  import FieldProblems from '#lib/components/FieldProblems.svelte';
  import Notice from '#lib/components/Notice.svelte';
  import RequestFields from '#lib/components/RequestFields.svelte';
  import { Button } from '#lib/components/ui/button/index.ts';
  import { kindLabels } from '#lib/format.ts';
  import { requestFieldLabels, requestValues } from '#lib/request-form.ts';

  let { data, form } = $props();
  const request = $derived(data.request);
  const values = $derived<Record<string, string>>(
    form?.values ? { ...requestValues(request), ...form.values } : requestValues(request)
  );
</script>

<svelte:head><title>Edit {request.title} · wunan</title></svelte:head>

<section class="grid max-w-2xl gap-6">
  <div class="grid gap-1">
    <h1 class="text-2xl font-semibold sm:text-3xl">Edit request</h1>
    <p class="text-muted-foreground">
      {kindLabels[request.kind]} · <a href="/requests/{request.id}">Back to the request</a>
    </p>
  </div>
  {#if form?.error}
    <Notice kind="error"
      ><p>{form.error}</p>
      <FieldProblems fields={form.fields} labels={requestFieldLabels} /></Notice
    >
  {/if}
  <form method="POST" class="grid gap-6">
    <RequestFields {values} fields={form?.fields ?? {}} fixedKind={request.kind} />
    <div><Button type="submit">Save changes</Button></div>
  </form>
</section>
