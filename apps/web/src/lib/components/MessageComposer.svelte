<!--
  Writing in a private thread: the same message box as everywhere (MessageBox), with a small "+"
  beside Send. It opens a panel right there to add things to the message: my phone number or email
  (each showing exactly what will be shared, 001 FR-019) and a time to call (001 FR-020). What's
  added shows as pills in the top part of the text box, each with an X, and goes with the text as
  one message. The panel is a <details>, so it works the same without JavaScript. Used on proposal
  and agreement pages and request-for-help threads; the page provides the `send` action
  (`threadActions`).
-->
<script lang="ts">
  import CalendarClockIcon from '@lucide/svelte/icons/calendar-clock';
  import MailIcon from '@lucide/svelte/icons/mail';
  import PhoneIcon from '@lucide/svelte/icons/phone';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import XIcon from '@lucide/svelte/icons/x';
  import { Label } from '#lib/components/ui/label/index.ts';
  import MessageBox from '#lib/components/MessageBox.svelte';
  import { when } from '#lib/format.ts';
  import { MESSAGE_LIMIT } from '@wunan/shared';
  import { untrack } from 'svelte';

  let {
    otherNames,
    contact,
    sent = false,
    status = '',
    values = {},
    fields = {},
    sendVariant = 'default'
  }: {
    otherNames: string;
    contact: { sharePhone: string | null; shareEmail: string | null };
    sent?: boolean;
    /** What just happened, e.g. "Your message is sent." */
    status?: string;
    /** What the member had sent, when the server sent it back with a problem. */
    values?: Record<string, string>;
    fields?: Record<string, string>;
    /** "outline" when the page already has another main button (one primary action per screen). */
    sendVariant?: 'default' | 'outline';
  } = $props();

  // What was added, kept when the server sends the message back with a problem.
  let phone = $state(untrack(() => !sent && values.phone === 'yes'));
  let email = $state(untrack(() => !sent && values.email === 'yes'));
  let callDate = $state(untrack(() => (sent ? '' : (values.callDate ?? ''))));
  let callTime = $state(untrack(() => (sent ? '' : (values.callTime ?? ''))));
  let open = $state(untrack(() => Boolean(fields.proposedTime)));
  let panel: HTMLDetailsElement | undefined = $state();
  const today = new Date().toISOString().slice(0, 10);
  const callText = $derived(
    callDate && callTime ? when(new Date(`${callDate}T${callTime}`).toISOString()) : null
  );

  // Adding or taking out a pill changes the box's height above the "+". While the panel is open
  // the page scrolls by the same amount, so the "+" and the panel stay under the pointer
  // (constitution V).
  let plusTop: number | null = null;
  $effect.pre(() => {
    void [phone, email, callText];
    plusTop = open && panel ? panel.getBoundingClientRect().top : null;
  });
  $effect(() => {
    void [phone, email, callText];
    if (plusTop === null || !panel) return;
    const moved = panel.getBoundingClientRect().top - plusTop;
    if (moved) window.scrollBy({ top: moved, behavior: 'instant' });
  });

  function clear() {
    phone = email = false;
    callDate = callTime = '';
    open = false;
  }
  // The panel closes on Escape or a click elsewhere, like any small pop-up.
  function outside(event: MouseEvent) {
    if (open && panel && !panel.contains(event.target as Node)) open = false;
  }
  const pill =
    'inline-flex min-h-9 items-center gap-1.5 rounded-full border border-input bg-accent py-1 pr-1 pl-3 text-sm';
  const pillX =
    'inline-flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground';
  const inputClass = 'min-h-11 w-full rounded-md border border-input bg-background px-3 text-base';
</script>

<svelte:window
  onclick={outside}
  onkeydown={(event) => {
    if (event.key === 'Escape' && open) {
      open = false;
      panel?.querySelector('summary')?.focus();
    }
  }}
/>

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
  problem={fields.proposedTime}
  {status}
  onSent={clear}
>
  {#snippet attached()}
    {#if phone || email || callText}
      <ul
        class="flex flex-wrap gap-2 border-b border-input bg-muted/40 p-2"
        aria-label="Added to your message"
      >
        {#if phone}<li class={pill}>
            <PhoneIcon class="size-4" aria-hidden="true" />Phone: {contact.sharePhone}
            <button
              type="button"
              class={pillX}
              aria-label="Take out your phone number"
              onclick={() => (phone = false)}><XIcon class="size-4" aria-hidden="true" /></button
            >
          </li>{/if}
        {#if email}<li class={pill}>
            <MailIcon class="size-4" aria-hidden="true" />Email: {contact.shareEmail}
            <button
              type="button"
              class={pillX}
              aria-label="Take out your email"
              onclick={() => (email = false)}><XIcon class="size-4" aria-hidden="true" /></button
            >
          </li>{/if}
        {#if callText}<li class={pill}>
            <CalendarClockIcon class="size-4" aria-hidden="true" />Call: {callText}
            <button
              type="button"
              class={pillX}
              aria-label="Take out the call time"
              onclick={() => (callDate = callTime = '')}
              ><XIcon class="size-4" aria-hidden="true" /></button
            >
          </li>{/if}
      </ul>
    {/if}
  {/snippet}

  {#snippet attach()}
    <details bind:this={panel} bind:open class="relative shrink-0">
      <summary
        class="inline-flex size-11 cursor-pointer list-none items-center justify-center rounded-md border border-input bg-card hover:bg-accent [&::-webkit-details-marker]:hidden"
        aria-label="Add your contact details or a time to call"
        title="Add contact details or a call time"
      >
        <PlusIcon class="size-5" aria-hidden="true" />
      </summary>
      <div
        class="absolute right-0 bottom-full z-10 mb-2 grid w-72 max-w-[calc(100vw-2rem)] gap-3 rounded-lg border bg-card p-3 shadow-md"
      >
        <p class="text-sm font-medium">Add to your message</p>
        {#if contact.sharePhone || contact.shareEmail}
          <div class="grid gap-1">
            {#if contact.sharePhone}<label class="flex min-h-11 items-center gap-3 text-sm"
                ><input
                  type="checkbox"
                  name="phone"
                  value="yes"
                  class="size-5 accent-primary"
                  bind:checked={phone}
                /><span
                  >My phone number<br /><span class="text-muted-foreground"
                    >{contact.sharePhone}</span
                  ></span
                ></label
              >{/if}
            {#if contact.shareEmail}<label class="flex min-h-11 items-center gap-3 text-sm"
                ><input
                  type="checkbox"
                  name="email"
                  value="yes"
                  class="size-5 accent-primary"
                  bind:checked={email}
                /><span
                  >My email<br /><span class="text-muted-foreground">{contact.shareEmail}</span
                  ></span
                ></label
              >{/if}
          </div>
        {:else}
          <p class="text-sm text-muted-foreground">
            To share a phone number or email, <a href="/settings">save it in Settings</a> first.
          </p>
        {/if}
        <fieldset class="grid min-w-0 gap-2">
          <legend class="mb-1 text-sm">A time to call</legend>
          <div class="grid gap-2">
            <div class="grid gap-1">
              <Label for="call-date" class="text-xs">Day</Label>
              <input
                id="call-date"
                name="callDate"
                type="date"
                min={today}
                class={inputClass}
                bind:value={callDate}
              />
            </div>
            <div class="grid gap-1">
              <Label for="call-time" class="text-xs">Time</Label>
              <input
                id="call-time"
                name="callTime"
                type="time"
                class={inputClass}
                bind:value={callTime}
              />
            </div>
          </div>
          <p class="text-xs text-muted-foreground">
            {otherNames} can accept it. The call happens outside wunan.
          </p>
        </fieldset>
      </div>
    </details>
  {/snippet}
</MessageBox>
