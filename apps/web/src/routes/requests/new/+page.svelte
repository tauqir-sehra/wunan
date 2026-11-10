<script lang="ts">
  import FieldProblems from '#lib/components/FieldProblems.svelte';
  import HelpLink from '#lib/components/HelpLink.svelte';
  import Notice from '#lib/components/Notice.svelte';
  import RequestFields from '#lib/components/RequestFields.svelte';
  import { Button } from '#lib/components/ui/button/index.ts';
  import { requestFieldLabels } from '#lib/request-form.ts';
  import { page } from '$app/state';
  import { onMount } from 'svelte';

  let { form } = $props();

  // The unfinished request is kept in this browser tab, so opening a suggestion and coming back
  // doesn't lose it (FR-011). Storage can be unavailable (private browsing); then nothing is kept.
  const DRAFT_KEY = 'wunan:request-draft';
  // From "Can't find something?" on Offerings: the words searched for start the title.
  const fromSearch = page.url.searchParams.get('title')?.slice(0, 100) ?? '';
  let draft = $state<Record<string, string> | null>(null);
  let formElement: HTMLFormElement | undefined = $state();
  onMount(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY);
      if (saved && !form?.values && !fromSearch)
        draft = JSON.parse(saved) as Record<string, string>;
    } catch {
      draft = null;
    }
  });
  function saveDraft() {
    if (!formElement) return;
    const values: Record<string, string> = {};
    for (const [name, value] of new FormData(formElement))
      if (typeof value === 'string') values[name] = value;
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(values));
    } catch {
      // Not kept; the form still works.
    }
  }
  function clearDraft() {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      // Nothing to clear.
    }
  }
  const values = $derived<Record<string, string>>(
    form?.values ?? draft ?? (fromSearch ? { title: fromSearch } : {})
  );
</script>

<svelte:head><title>Request something · wunan</title></svelte:head>

<section class="grid max-w-2xl gap-6">
  <div class="flex items-start justify-between gap-3">
    <h1 class="text-2xl font-semibold sm:text-3xl">Request something</h1>
    <HelpLink topic="requests" label="Help with requesting something" />
  </div>
  <p class="text-muted-foreground">
    Say what you need. Others can offer something for it, and you choose what to ask for.
  </p>

  {#if form?.error}
    <Notice kind="error"
      ><p>{form.error}</p>
      <FieldProblems fields={form.fields} labels={requestFieldLabels} /></Notice
    >
  {/if}

  <form
    method="POST"
    class="grid gap-6"
    bind:this={formElement}
    oninput={saveDraft}
    onchange={saveDraft}
    onsubmit={clearDraft}
  >
    {#key draft}
      <RequestFields {values} fields={form?.fields ?? {}} />
    {/key}
    <div><Button type="submit">Post request</Button></div>
  </form>
</section>
