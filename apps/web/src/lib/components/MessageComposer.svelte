<!--
  Writing in a private thread: the same message box as everywhere (MessageBox), then two small
  buttons that open pop-ups: sharing chosen contact details (after seeing exactly what will be
  shown, 001 FR-019) and suggesting a time to call (001 FR-020). Used on proposal pages and
  request-for-help threads; the page provides the actions `send`, `shareContact`, `proposeCall`.
  All of them update the page in place: the pop-up closes and what happened shows under the box,
  so nothing jumps (constitution V).
-->
<script lang="ts">
  import { enhance, type SubmitFunction } from '$app/forms';
  import CalendarClockIcon from '@lucide/svelte/icons/calendar-clock';
  import ContactIcon from '@lucide/svelte/icons/contact';
  import PopupDialog from '#lib/components/PopupDialog.svelte';
  import { Button } from '#lib/components/ui/button/index.ts';
  import { Label } from '#lib/components/ui/label/index.ts';
  import MessageBox from '#lib/components/MessageBox.svelte';
  import { MESSAGE_LIMIT } from '@wunan/shared';

  let {
    conversationId,
    otherNames,
    contact,
    sent = false,
    status = '',
    values = {},
    fields = {},
    sendVariant = 'default'
  }: {
    conversationId: string;
    otherNames: string;
    contact: { sharePhone: string | null; shareEmail: string | null };
    sent?: boolean;
    /** What just happened, e.g. "Your contact details were shared." */
    status?: string;
    values?: Record<string, string>;
    fields?: Record<string, string>;
    /** "outline" when the page already has another main button (one primary action per screen). */
    sendVariant?: 'default' | 'outline';
  } = $props();

  let phone = $state(false);
  let email = $state(false);
  let reviewing = $state(false);
  const today = new Date().toISOString().slice(0, 10);
  const nothingSaved = $derived(!contact.sharePhone && !contact.shareEmail);
  let sharing = $state(false);
  let calling = $state(false);
  // A time that couldn't be used reopens the pop-up with the problem.
  $effect(() => {
    if (fields.proposedTime) calling = true;
  });
  // After a pop-up's form is sent, close the pop-up and stay where the page is.
  const closing =
    (close: () => void): SubmitFunction =>
    () =>
    async ({ result, update }) => {
      await update({ reset: false });
      if (result.type === 'success') close();
    };
  const inputClass = 'min-h-11 rounded-md border border-input bg-card px-3 text-base';
</script>

<MessageBox
  id="message-body"
  label="Write a message"
  action="?/send#messages"
  hint="Only {otherNames} and you can read this."
  maxlength={MESSAGE_LIMIT}
  buttonLabel="Send"
  buttonVariant={sendVariant}
  value={sent ? '' : (values.body ?? '')}
  error={fields.body}
  status={status}
>
  {#snippet extra()}
    <PopupDialog
      label="Share contact"
      bind:open={sharing}
      icon={ContactIcon}
      title="Share your contact details"
      description="Only {otherNames} will see what you share, here in your messages. Once shared, it stays."
      fallbackHref="/threads/{conversationId}/share-contact"
    >
      {#if nothingSaved}
        <p>You haven't saved a phone number or email to share yet.</p>
        <p><a href="/settings">Add them in Settings</a>, then come back here.</p>
      {:else if reviewing}
        <p>This is exactly what {otherNames} will see:</p>
        <div class="rounded-lg border bg-card p-4">
          {#if phone}<p>Phone: {contact.sharePhone}</p>{/if}
          {#if email}<p>Email: {contact.shareEmail}</p>{/if}
        </div>
        <form
            method="POST"
            action="?/shareContact#messages"
            class="flex flex-wrap items-center gap-3"
            use:enhance={closing(() => {
              sharing = false;
              reviewing = false;
              phone = email = false;
            })}
          >
          <input type="hidden" name="phone" value={phone ? 'yes' : 'no'} />
          <input type="hidden" name="email" value={email ? 'yes' : 'no'} />
          <Button type="submit">Yes, share it</Button>
          <Button type="button" variant="ghost" onclick={() => (reviewing = false)}
            >Change what to share</Button
          >
        </form>
      {:else}
        <fieldset class="grid min-w-0 gap-2">
          <legend class="mb-1 font-medium">What would you like to share?</legend>
          {#if contact.sharePhone}
            <label class="flex min-h-11 items-center gap-3"
              ><input type="checkbox" class="size-6 accent-primary" bind:checked={phone} /> My phone number</label
            >
          {/if}
          {#if contact.shareEmail}
            <label class="flex min-h-11 items-center gap-3"
              ><input type="checkbox" class="size-6 accent-primary" bind:checked={email} /> My email</label
            >
          {/if}
        </fieldset>
        <div>
          <Button type="button" disabled={!phone && !email} onclick={() => (reviewing = true)}
            >Review</Button
          >
        </div>
      {/if}
    </PopupDialog>

    <PopupDialog
      label="Suggest a call"
      bind:open={calling}
      icon={CalendarClockIcon}
      title="Suggest a time to call"
      description="{otherNames} can accept it. The call itself happens outside wunan, by phone or any app you both use."
      fallbackHref="/threads/{conversationId}/call"
    >
      <form method="POST" action="?/proposeCall#messages" class="grid gap-4" use:enhance={closing(() => (calling = false))}>
        {#if fields.proposedTime}<p class="font-medium text-destructive">
            {fields.proposedTime}
          </p>{/if}
        <div class="flex flex-wrap gap-4">
          <div class="grid gap-1">
            <Label for="call-date">Day</Label><input
              id="call-date"
              name="date"
              type="date"
              min={today}
              required
              class={inputClass}
            />
          </div>
          <div class="grid gap-1">
            <Label for="call-time">Time</Label><input
              id="call-time"
              name="time"
              type="time"
              required
              class={inputClass}
            />
          </div>
        </div>
        <div><Button type="submit">Suggest this time</Button></div>
      </form>
    </PopupDialog>
  {/snippet}
</MessageBox>
