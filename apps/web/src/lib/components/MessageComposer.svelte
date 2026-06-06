<!--
  Writing in a thread: the message box with "Send" on the left, and on the right two small
  buttons that open pop-ups: sharing chosen contact details (after seeing exactly what will be
  shown, 001 FR-019) and suggesting a time to call (001 FR-020). Used on proposal pages and
  request-for-help threads; the page provides the actions `send`, `shareContact`, `proposeCall`.
-->
<script lang="ts">
  import CalendarClockIcon from '@lucide/svelte/icons/calendar-clock';
  import ContactIcon from '@lucide/svelte/icons/contact';
  import FormField from '#lib/components/FormField.svelte';
  import PopupDialog from '#lib/components/PopupDialog.svelte';
  import { Button } from '#lib/components/ui/button/index.ts';
  import { Label } from '#lib/components/ui/label/index.ts';

  let {
    conversationId,
    otherNames,
    contact,
    sent = false,
    values = {},
    fields = {},
    sendVariant = 'default'
  }: {
    conversationId: string;
    otherNames: string;
    contact: { sharePhone: string | null; shareEmail: string | null };
    sent?: boolean;
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
  const inputClass = 'min-h-11 rounded-md border border-input bg-card px-3 text-base';
</script>

<form id="message-form" method="POST" action="?/send" class="grid gap-3">
  <FormField label="Write a message" name="body" multiline required maxlength={4000} value={sent ? '' : values.body} error={fields.body} />
</form>
<div class="flex flex-wrap items-center justify-between gap-2">
  <Button type="submit" form="message-form" variant={sendVariant}>Send</Button>
  <div class="flex flex-wrap gap-2">
    <PopupDialog
      label="Share contact"
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
          <form method="POST" action="?/shareContact" class="flex flex-wrap items-center gap-3">
            <input type="hidden" name="phone" value={phone ? 'yes' : 'no'} />
            <input type="hidden" name="email" value={email ? 'yes' : 'no'} />
            <Button type="submit">Yes, share it</Button>
            <Button type="button" variant="ghost" onclick={() => (reviewing = false)}>Change what to share</Button>
          </form>
        {:else}
          <fieldset class="grid min-w-0 gap-2">
            <legend class="mb-1 font-medium">What would you like to share?</legend>
            {#if contact.sharePhone}
              <label class="flex min-h-11 items-center gap-3"><input type="checkbox" class="size-6 accent-primary" bind:checked={phone} /> My phone number</label>
            {/if}
            {#if contact.shareEmail}
              <label class="flex min-h-11 items-center gap-3"><input type="checkbox" class="size-6 accent-primary" bind:checked={email} /> My email</label>
            {/if}
          </fieldset>
          <div><Button type="button" disabled={!phone && !email} onclick={() => (reviewing = true)}>Review</Button></div>
        {/if}
    </PopupDialog>

    <PopupDialog
      label="Suggest a call"
      icon={CalendarClockIcon}
      title="Suggest a time to call"
      description="{otherNames} can accept it. The call itself happens outside wunan, by phone or any app you both use."
      fallbackHref="/threads/{conversationId}/call"
      open={Boolean(fields.proposedTime)}
    >
        <form method="POST" action="?/proposeCall" class="grid gap-4">
          {#if fields.proposedTime}<p class="font-medium text-destructive">{fields.proposedTime}</p>{/if}
          <div class="flex flex-wrap gap-4">
            <div class="grid gap-1"><Label for="call-date">Day</Label><input id="call-date" name="date" type="date" min={today} required class={inputClass} /></div>
            <div class="grid gap-1"><Label for="call-time">Time</Label><input id="call-time" name="time" type="time" required class={inputClass} /></div>
          </div>
          <div><Button type="submit">Suggest this time</Button></div>
        </form>
    </PopupDialog>
  </div>
</div>
