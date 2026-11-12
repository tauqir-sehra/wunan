<!--
  One arrangement (004 US2) at one address from asking to the end. Left: where it stands, what has
  happened, the details (or, once agreed, what was agreed), what is still to settle, and what this
  member can do next, with exactly one filled button (FR-017). Right: the messages. Every action
  stays on this page, keeps it where it was scrolled, and shows its result beside the button that
  was pressed (constitution V); without JavaScript each returns to the same part of the page.
  A helper from a request for help sees it read-only, with the messages only if they were shared.
-->
<script lang="ts">
  import { enhance } from '$app/forms';
  import { page } from '$app/state';
  import ArrangementDetails from '#lib/components/ArrangementDetails.svelte';
  import ArrangementMessages from '#lib/components/ArrangementMessages.svelte';
  import FormField from '#lib/components/FormField.svelte';
  import HelpLink from '#lib/components/HelpLink.svelte';
  import Notice from '#lib/components/Notice.svelte';
  import Timeline from '#lib/components/Timeline.svelte';
  import { Badge } from '#lib/components/ui/badge/index.ts';
  import { Button } from '#lib/components/ui/button/index.ts';
  import { sideWords, stageLabels, stageWords } from '#lib/format.ts';
  import { reveal, stayPut } from '#lib/stay-put.ts';

  let { data, form } = $props();
  const a = $derived(data.arrangement);
  const me = $derived(a.myRole);
  const other = $derived(me === 'lister' ? a.requester : a.lister);
  const isLoan = $derived(a.offering.type === 'lend');

  const line = $derived(
    stageWords({
      ...a,
      listerName: a.lister.displayName,
      startsAt: a.details.startsAt,
      hasTime: a.details.hasTime,
      loanEndsAt: a.agreed?.loanEndsAt ?? null,
      overdue: a.agreed?.overdue ?? false,
      returnedAt: a.agreed?.returnedAt ?? null,
      doneAt: a.agreed?.doneAt ?? null
    })
  );
  /** Why it ended, in the same blame-free words as before. */
  const whyEnded = $derived(
    a.status === 'declined'
      ? `${a.lister.displayName} declined this.`
      : a.status === 'withdrawn'
        ? `${a.requester.displayName} withdrew this.`
        : a.closedReason === 'nothing_left'
          ? 'Nothing is left on the offering. Nobody did anything wrong.'
          : a.closedReason === 'member_left'
            ? 'One of you left wunan.'
            : a.status === 'closed'
              ? 'Nothing happened for a month, so it closed by itself.'
              : null
  );

  // The one filled button (FR-017): the next thing this member can do at this stage.
  const primary = $derived.by(() => {
    if (me === 'helper') return null;
    if (a.status === 'open')
      return me === 'lister' ? (a.canAccept ? 'accept' : null) : a.issues.length ? 'edit' : null;
    if (a.status === 'agreed') {
      if (isLoan) return me === 'lister' && !a.agreed?.returnedAt ? 'returned' : null;
      return a.agreed?.doneAt ? null : 'done';
    }
    return a.canAskAgain ? 'askAgain' : null;
  });
  // A problem with one of this page's actions; a problem sending a message shows by the message box.
  const actionError = $derived.by(() => {
    const f = form as { error?: string; values?: Record<string, string> } | null;
    return f?.error && f.values?.body === undefined ? f.error : null;
  });
  const variant = (action: string) => (primary === action ? 'default' : 'outline');
  const action = $derived(me === 'lister' ? 'decline' : 'withdraw');
  const doneText: Record<string, string> = {
    accepted: "Accepted. You've agreed on these details.",
    declined: 'You declined this.',
    withdrawn: 'You withdrew this.',
    returned: 'Marked as returned. Those dates are free again.',
    marked_done: 'Marked as done. You can take this back.',
    not_done: 'Marked as not done yet.'
  };
</script>

<svelte:head><title>{a.offering.title} · Arrangements · wunan</title></svelte:head>

<section class="grid gap-6">
  {#if page.url.searchParams.has('made') && !form}<Notice
      ><p>Sent to {a.lister.displayName}. You'll see their answer here.</p></Notice
    >{/if}

  <header class="grid gap-1">
    <div class="flex items-start justify-between gap-3">
      <h1 class="text-2xl font-semibold sm:text-3xl">
        {sideWords(a.offering.type, me, a.requester.displayName)}
        <a href="/offerings/{a.offering.id}">{a.offering.title}</a>
      </h1>
      <HelpLink topic="arrangements" label="Help with arrangements" />
    </div>
    <p class="text-muted-foreground">
      {#if me === 'helper'}Between {a.requester.displayName} and {a.lister.displayName}
      {:else}With <a href="/members/{other.id}">{other.displayName}</a>{/if}
      · <a href="/arrangements">All arrangements</a>
    </p>
  </header>

  {#if me === 'helper'}
    <Notice kind="info"
      ><p>
        You're seeing this to help. Only {a.requester.displayName} and {a.lister.displayName} can change
        it.
      </p></Notice
    >
  {/if}

  <!-- Wide screens: the arrangement on the left, its messages on the right. -->
  <div class="page-columns">
    <div class="grid gap-6">
      <div class="grid gap-1.5" id="stage">
        <p class="flex flex-wrap items-center gap-2 text-lg font-medium">
          <Badge variant={a.stage === 'ended' ? 'outline' : 'default'}>{stageLabels[a.stage]}</Badge
          >
          {line}
        </p>
        {#if whyEnded}<p class="text-muted-foreground">
            {whyEnded}{#if a.decisionNote}
              Their note: {a.decisionNote}{/if}
          </p>{/if}
      </div>

      <Timeline steps={a.timeline} />
      <ArrangementDetails arrangement={a} />

      {#if me !== 'helper'}
        <!-- Every action updates the page in place; its result shows here (constitution V). -->
        <div id="decision" class="flex flex-wrap items-start gap-3">
          {#if a.status === 'open'}
            {#if me === 'lister'}
              <!-- Always shown, so the lister knows where it will be; it can't be pressed until nothing blocks it. -->
              <form
                method="POST"
                action="?/accept#decision"
                class="grid w-full gap-2"
                use:enhance={stayPut(undefined, { reset: false })}
              >
                <input type="hidden" name="version" value={a.version} />
                <p id="accept-note" class={a.canAccept ? '' : 'text-muted-foreground'}>
                  {a.canAccept
                    ? "Accepting means you've agreed on exactly these details."
                    : `You can accept once ${a.requester.displayName} has filled in everything above. You can ask them in a message.`}
                </p>
                <div>
                  <Button
                    type="submit"
                    variant={variant('accept')}
                    disabled={!a.canAccept}
                    aria-describedby="accept-note">Accept</Button
                  >
                </div>
              </form>
            {:else}
              {#if !a.issues.length}<p class="w-full">
                  Everything is filled in. Waiting for {a.lister.displayName} to accept it.
                </p>{/if}
              <Button href="/arrangements/{a.id}/edit" variant={variant('edit')}
                >Change details</Button
              >
            {/if}

            {#if form?.confirm === action}
              <form
                method="POST"
                action="?/{action}#decision"
                class="grid w-full gap-3 surface p-5"
                use:enhance={stayPut()}
                use:reveal
              >
                <input type="hidden" name="confirmed" value="yes" />
                <p>
                  {action === 'decline'
                    ? `Decline this? ${a.requester.displayName} is told, and can ask again.`
                    : `Withdraw this? ${a.lister.displayName} is told.`}
                </p>
                <FormField
                  label="A note"
                  name="note"
                  multiline
                  optional
                  maxlength={500}
                  hint="Optional. Shown to {other.displayName}."
                />
                <div class="flex flex-wrap items-center gap-3">
                  <Button type="submit" variant="destructive"
                    >{action === 'decline' ? 'Yes, decline it' : 'Yes, withdraw it'}</Button
                  >
                  <a href="/arrangements/{a.id}#decision" data-sveltekit-reset="false"
                    >Keep it open</a
                  >
                </div>
              </form>
            {:else}
              <form method="POST" action="?/{action}#decision" use:enhance={stayPut()}>
                <Button type="submit" variant="outline"
                  >{action === 'decline' ? 'Decline' : 'Withdraw'}</Button
                >
              </form>
            {/if}
          {:else if a.status === 'agreed'}
            {#if isLoan}
              {#if me === 'lister' && !a.agreed?.returnedAt}
                <form method="POST" action="?/returned#decision" use:enhance={stayPut()}>
                  <Button type="submit" variant={variant('returned')}>Mark returned</Button>
                </form>
              {/if}
            {:else if a.agreed?.doneAt}
              <form method="POST" action="?/notDone#decision" use:enhance={stayPut()}>
                <Button type="submit" variant="outline">Not done yet</Button>
              </form>
            {:else}
              <form
                method="POST"
                action="?/done#decision"
                class="grid gap-1.5"
                use:enhance={stayPut()}
              >
                <div><Button type="submit" variant={variant('done')}>Mark as done</Button></div>
                <p class="text-sm text-muted-foreground">
                  Optional. Either of you can mark it once it's happened.
                </p>
              </form>
            {/if}
          {:else if a.canAskAgain}
            <Button href="/offerings/{a.offering.id}/propose" variant={variant('askAgain')}
              >Ask again</Button
            >
          {/if}

          {#if form?.changed}<div class="w-full">
              <Notice kind="error"><p>{form.changed} The new details are shown above.</p></Notice>
            </div>{/if}
          {#if form?.done && doneText[form.done]}<div class="w-full">
              <Notice><p>{doneText[form.done]}</p></Notice>
            </div>{/if}
          {#if actionError}<div class="w-full">
              <Notice kind="error"><p>{actionError}</p></Notice>
            </div>{/if}
        </div>
      {/if}

      {#if a.status === 'agreed'}
        {#if a.reports.length}
          <section class="grid gap-2" aria-labelledby="help-heading">
            <h2 id="help-heading" class="text-lg font-semibold">Asking for help</h2>
            <ul class="grid gap-2">
              {#each a.reports as report (report.id)}
                <li>
                  <a href="/reports/{report.id}"
                    >{report.status === 'open' ? 'Open request for help' : 'Settled'}</a
                  >
                  {#if report.outcomeNote}<span class="text-muted-foreground">
                      — {report.outcomeNote}</span
                    >{/if}
                </li>
              {/each}
            </ul>
          </section>
        {/if}
        {#if me !== 'helper' && !a.reports.some((r) => r.status === 'open')}
          <p class="text-muted-foreground">
            Something went wrong? <a href="/arrangements/{a.id}/report">Ask for help</a> from the invite
            chain.
          </p>
        {/if}
      {/if}
    </div>

    {#if data.thread && a.conversationId}
      <ArrangementMessages
        thread={data.thread}
        conversationId={a.conversationId}
        meId={data.member?.id ?? ''}
        otherName={me === 'helper' ? a.requester.displayName : other.displayName}
        {form}
        sendVariant={primary ? 'outline' : 'default'}
        closedText={me === 'helper'
          ? 'You can read these messages because they were shared with you to help.'
          : 'This arrangement has ended, so no new messages can be added.'}
      />
    {/if}
  </div>
</section>
