<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { Button } from '#lib/components/ui/button/index.ts';
  import Notice from '#lib/components/Notice.svelte';
  import SettingsNav from '#lib/components/SettingsNav.svelte';
  import { day } from '#lib/format.ts';

  let { data, form } = $props();

  const kinds = [
    { type: 'message', label: 'New messages', hint: 'When someone sends you a message. At most once an hour for each conversation.' },
    { type: 'agreement', label: 'Agreements', hint: 'When someone records or cancels an agreement with you, or asks for a correction.' },
    { type: 'reminder', label: 'Return reminders', hint: 'Once, the day after something lent was due back.' },
    { type: 'report', label: 'Requests for help', hint: "When someone asks for help with an agreement you're part of or helping with." },
    { type: 'flag', label: 'Requests about your listings', hint: 'When someone raises a conflict about one of your listings.' }
  ] as const;

  const setting = (type: string) => data.preferences.find((p) => p.type === type);

  // This device. Everything here needs JavaScript and runs only after the member presses a button:
  // wunan never asks the browser for permission by itself (FR-031a).
  type DeviceState = 'checking' | 'unsupported' | 'needs-home-screen' | 'blocked' | 'off' | 'on' | 'working';
  let deviceState = $state<DeviceState>('checking');
  let deviceProblem = $state('');
  const DEVICE_ID_KEY = 'wunan-device-id';

  function rememberedDeviceId() {
    try {
      return localStorage.getItem(DEVICE_ID_KEY);
    } catch {
      return null;
    }
  }
  function rememberDeviceId(id: string | null) {
    try {
      if (id) localStorage.setItem(DEVICE_ID_KEY, id);
      else localStorage.removeItem(DEVICE_ID_KEY);
    } catch {
      // Private browsing may block storage; turning off from the list below still works.
    }
  }

  const isAppleMobile = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isInstalled = () => matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && navigator.standalone === true);

  async function checkDevice() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      deviceState = isAppleMobile() && !isInstalled() ? 'needs-home-screen' : 'unsupported';
      return;
    }
    if (Notification.permission === 'denied') {
      deviceState = 'blocked';
      return;
    }
    // `getRegistration` answers straight away; there is none until the service worker is installed.
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = registration ? await registration.pushManager.getSubscription() : null;
    const id = rememberedDeviceId();
    deviceState = subscription && id && data.devices.devices.some((d) => d.id === id) ? 'on' : 'off';
  }

  $effect(() => {
    void data.devices;
    checkDevice().catch(() => (deviceState = 'unsupported'));
  });

  function deviceLabel() {
    const ua = navigator.userAgent;
    const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
    const system = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : '';
    return system ? `${browser} on ${system}` : browser;
  }

  function keyBytes(base64url: string) {
    const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
    return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  }

  /** The installed service worker, waiting a little while if it is still being installed. */
  async function serviceWorker() {
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('')), 10_000));
    return Promise.race([navigator.serviceWorker.ready, timeout]);
  }

  async function turnOn() {
    if (!data.devices.publicKey) return;
    deviceProblem = '';
    deviceState = 'working';
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        deviceState = permission === 'denied' ? 'blocked' : 'off';
        return;
      }
      const registration = await serviceWorker();
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(data.devices.publicKey) }));
      const json = subscription.toJSON();
      const response = await fetch('/settings/notifications/device', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ platform: 'web', endpoint: json.endpoint, keys: json.keys, label: deviceLabel() })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error ?? '');
      rememberDeviceId(result.id);
      await invalidateAll();
      deviceState = 'on';
    } catch (problem) {
      deviceProblem = problem instanceof Error && problem.message ? problem.message : "Notifications couldn't be turned on on this device. Please try again.";
      deviceState = 'off';
    }
  }

  async function turnOff() {
    deviceProblem = '';
    deviceState = 'working';
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      await (await registration?.pushManager.getSubscription())?.unsubscribe();
      const id = rememberedDeviceId();
      if (id) await fetch(`/settings/notifications/device/${encodeURIComponent(id)}`, { method: 'DELETE' });
      rememberDeviceId(null);
      await invalidateAll();
      deviceState = 'off';
    } catch {
      deviceProblem = "Notifications couldn't be turned off here. You can remove this device from the list below.";
      deviceState = 'on';
    }
  }
</script>

<svelte:head><title>Notifications · Settings · wunan</title></svelte:head>

<section class="grid gap-8">
  <div class="grid gap-4">
    <h1 class="text-2xl font-semibold">Settings</h1>
    <SettingsNav />
  </div>

  {#if form?.saved === 'preferences'}
    <Notice><p>Your notification settings are saved.</p></Notice>
  {:else if form?.saved === 'removed'}
    <Notice><p>That device won't get notifications any more.</p></Notice>
  {:else if form?.error}
    <Notice kind="error"><p>{form.error}</p></Notice>
  {/if}

  <section class="grid max-w-xl gap-4" aria-labelledby="kinds-heading">
    <h2 id="kinds-heading" class="text-xl font-semibold">What to tell you about</h2>
    <p class="text-muted-foreground">
      Everything is also waiting for you in wunan, so you can leave these off. Notifications never
      include contact details or photos.
    </p>
    <form method="POST" action="?/save" class="grid gap-4">
      {#each kinds as kind (kind.type)}
        <fieldset class="grid gap-2 rounded-lg border bg-card p-4" aria-describedby="hint-{kind.type}">
          <legend class="px-1 font-medium">{kind.label}</legend>
          <p id="hint-{kind.type}" class="text-sm text-muted-foreground">{kind.hint}</p>
          <div class="flex flex-wrap gap-x-8">
            <label class="flex min-h-11 items-center gap-3">
              <input type="checkbox" name="email-{kind.type}" class="size-6 shrink-0 accent-primary" checked={setting(kind.type)?.email} />
              <span>By email</span>
            </label>
            <label class="flex min-h-11 items-center gap-3">
              <input type="checkbox" name="device-{kind.type}" class="size-6 shrink-0 accent-primary" checked={setting(kind.type)?.device} />
              <span>On my devices</span>
            </label>
          </div>
        </fieldset>
      {/each}
      <div><Button type="submit">Save notification settings</Button></div>
    </form>
  </section>

  <section class="grid max-w-xl gap-4" aria-labelledby="device-heading">
    <h2 id="device-heading" class="text-xl font-semibold">This device</h2>
    {#if !data.devices.publicKey}
      <p class="text-muted-foreground">Device notifications aren't set up on this wunan. Email notifications still work.</p>
    {:else}
      <p class="text-muted-foreground">
        Get quiet notifications on this phone or computer, without installing an app. When you press
        the button, your browser asks whether wunan may show notifications. If none of the "On my
        devices" boxes above are ticked yet, they are all ticked for you; you can untick any of them
        afterwards. Notifications make no sound.
      </p>
      <div aria-live="polite" class="grid gap-3">
        {#if deviceState === 'checking'}
          <noscript><p>Turning on device notifications needs JavaScript in your browser.</p></noscript>
        {:else if deviceState === 'unsupported'}
          <p>This browser can't show notifications from websites. Email notifications still work.</p>
        {:else if deviceState === 'needs-home-screen'}
          <p>
            On an iPhone or iPad, first add wunan to your Home Screen: tap the Share button, then
            "Add to Home Screen". Open wunan from there and come back to this page.
          </p>
        {:else if deviceState === 'blocked'}
          <p>
            Notifications from wunan are blocked in this browser's settings. To use them, allow
            notifications for this site in your browser settings, then reload this page.
          </p>
        {:else if deviceState === 'on'}
          <p>Notifications are on for this device.</p>
          <div><Button type="button" variant="outline" onclick={turnOff}>Turn off on this device</Button></div>
        {:else}
          <div>
            <Button type="button" onclick={turnOn} disabled={deviceState === 'working'}>
              {deviceState === 'working' ? 'Turning on…' : 'Turn on notifications on this device'}
            </Button>
          </div>
        {/if}
        {#if deviceProblem}
          <Notice kind="error"><p>{deviceProblem}</p></Notice>
        {/if}
      </div>
    {/if}
  </section>

  <section class="grid max-w-xl gap-4" aria-labelledby="devices-heading">
    <h2 id="devices-heading" class="text-xl font-semibold">Your devices</h2>
    {#if data.devices.devices.length === 0}
      <p class="text-muted-foreground">No devices get notifications.</p>
    {:else}
      <ul class="grid gap-2">
        {#each data.devices.devices as device (device.id)}
          <li class="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
            <span>
              <span class="font-medium">{device.label}</span>
              <span class="block text-sm text-muted-foreground">Added {day(device.createdAt.slice(0, 10))}</span>
            </span>
            <form method="POST" action="?/removeDevice">
              <input type="hidden" name="id" value={device.id} />
              <Button type="submit" variant="outline">Remove<span class="sr-only"> {device.label}</span></Button>
            </form>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</section>
